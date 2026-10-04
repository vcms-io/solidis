/** Built artifacts: every published entry point must load under plain Node. */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  buildCommonJsDeclarations,
  buildDistributions,
} from '../../../build/distributions.ts';

interface PackageExportTarget {
  import: { types: string; default: string };
  require: { types: string; default: string };
}

let outputDirectory = '';
let commandNames: string[] = [];

function runNode(type: 'commonjs' | 'module', script: string) {
  return execFileSync(
    process.execPath,
    [`--input-type=${type}`, '--eval', script],
    { cwd: outputDirectory, encoding: 'utf8' },
  );
}

describe('distributions', () => {
  before(async () => {
    outputDirectory = await mkdtemp(join(tmpdir(), 'solidis-distributions-'));

    await buildDistributions(outputDirectory);

    commandNames = (await readdir(join(outputDirectory, 'command')))
      .filter((file) => file.endsWith('.cjs'))
      .map((file) => file.slice(0, -'.cjs'.length));
  });

  after(async () => {
    await rm(outputDirectory, { recursive: true, force: true });
  });

  it('builds one module per command', () => {
    assert.ok(commandNames.includes('get'));
    assert.ok(commandNames.includes('multi'));
    assert.ok(!commandNames.includes('sync'));
    assert.ok(!commandNames.includes('client.reply'));
  });

  it('requires every CommonJS module without a circular-import failure', () => {
    const entries = [
      './index.cjs',
      './client.cjs',
      './client/featured.cjs',
      './command/index.cjs',
      ...commandNames.map((name) => `./command/${name}.cjs`),
    ];
    const output = runNode(
      'commonjs',
      `const entries = ${JSON.stringify(entries)};
      let loaded = 0;
      for (const entry of entries) {
        const exported = require(entry);
        if (Object.keys(exported).length === 0) {
          throw new Error(entry + ' has no exports');
        }
        loaded += 1;
      }
      process.stdout.write(String(loaded));`,
    );

    assert.strictEqual(Number(output), entries.length);
  });

  it('imports every ES module', () => {
    const entries = [
      './index.mjs',
      './client.mjs',
      './client/featured.mjs',
      './command/index.mjs',
      ...commandNames.map((name) => `./command/${name}.mjs`),
    ];
    const output = runNode(
      'module',
      `const entries = ${JSON.stringify(entries)};
      let loaded = 0;
      for (const entry of entries) {
        const exported = await import(entry);
        if (Object.keys(exported).length === 0) {
          throw new Error(entry + ' has no exports');
        }
        loaded += 1;
      }
      process.stdout.write(String(loaded));`,
    );

    assert.strictEqual(Number(output), entries.length);
  });

  it('inlines the constants of common/internal.ts instead of importing them', async () => {
    const internal = ['cjs', 'mjs'].map((extension) =>
      join(outputDirectory, 'common', `internal.${extension}`),
    );
    const importers: string[] = [];

    for (const file of await readdir(outputDirectory, { recursive: true })) {
      if (!/\.[cm]js$/.test(file)) {
        continue;
      }

      const path = join(outputDirectory, file);
      const contents = await readFile(path, 'utf8');

      for (const [, specifier] of contents.matchAll(
        /(?:from|require\()\s*"(\.[^"]+)"/g,
      )) {
        if (internal.includes(join(dirname(path), specifier))) {
          importers.push(file);
        }
      }
    }

    assert.deepStrictEqual(importers, []);
  });

  it('exposes the same client API through CommonJS and ES modules', () => {
    const script = (load: string) =>
      `${load}
      const client = new SolidisFeaturedClient({ lazyConnect: true });
      const methods = Object.keys(client).filter((key) => typeof client[key] === 'function');
      process.stdout.write(JSON.stringify([typeof SolidisClient, methods.length]));`;
    const commonjs = runNode(
      'commonjs',
      script(
        `const { SolidisClient } = require('./index.cjs');
        const { SolidisFeaturedClient } = require('./client/featured.cjs');`,
      ),
    );
    const module = runNode(
      'module',
      script(
        `const { SolidisClient } = await import('./index.mjs');
        const { SolidisFeaturedClient } = await import('./client/featured.mjs');`,
      ),
    );

    assert.deepStrictEqual(JSON.parse(commonjs), JSON.parse(module));
    assert.strictEqual(JSON.parse(commonjs)[0], 'function');
    assert.ok(JSON.parse(commonjs)[1] > 300);
  });

  it('writes CommonJS declarations that import each other', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'solidis-declarations-'));

    try {
      await mkdir(join(directory, 'command'));
      await writeFile(
        join(directory, 'index.d.ts'),
        "export * from './client.ts';\nimport type { EventEmitter } from 'node:events';\n",
      );
      await writeFile(
        join(directory, 'command', 'get.d.ts'),
        'import type { RespString } from "../types/resp.ts";\nexport type Value = import(\'../index.ts\').Value;\n',
      );

      await buildCommonJsDeclarations(directory);

      assert.strictEqual(
        await readFile(join(directory, 'index.d.cts'), 'utf8'),
        "export * from './client.cts';\nimport type { EventEmitter } from 'node:events';\n",
      );
      assert.strictEqual(
        await readFile(join(directory, 'command', 'get.d.cts'), 'utf8'),
        'import type { RespString } from "../types/resp.cts";\nexport type Value = import(\'../index.cts\').Value;\n',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('types require() with CommonJS declarations and import with ES ones', async () => {
    const packageJson = JSON.parse(
      await readFile(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { exports: Record<string, PackageExportTarget> };

    for (const target of Object.values(packageJson.exports)) {
      assert.match(target.require.types, /\.d\.cts$/);
      assert.match(target.import.types, /\.d\.ts$/);
    }
  });

  it('points every package.json export at a file that exists', async () => {
    const packageJson = JSON.parse(
      await readFile(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { exports: Record<string, PackageExportTarget> };
    const targets = Object.values(packageJson.exports).flatMap((target) =>
      [
        target.import.default,
        target.require.default,
        target.import.types,
        target.require.types,
      ].flatMap((path) =>
        path.includes('*')
          ? commandNames.map((name) => path.replace('*', name))
          : [path],
      ),
    );
    const missing = targets.filter(
      (target) =>
        !existsSync(
          /\.d\.c?ts$/.test(target)
            ? target
                .replace('./distributions/', './sources/')
                .replace(/\.d\.c?ts$/, '.ts')
            : join(outputDirectory, target.replace('./distributions/', '')),
        ),
    );

    assert.ok(targets.length > 1000);
    assert.deepStrictEqual(missing, []);
  });

  it('keeps the names of classes and functions', () => {
    const script = (load: string) =>
      `${load}
      process.stdout.write(JSON.stringify([SolidisClient.name, SolidisFeaturedClient.name, SolidisCommandError.name, RespPush.name, set.name]));`;
    const names = [
      'SolidisClient',
      'SolidisFeaturedClient',
      'SolidisCommandError',
      'RespPush',
      'set',
    ];

    assert.deepStrictEqual(
      JSON.parse(
        runNode(
          'commonjs',
          script(
            `const { SolidisClient, SolidisCommandError, RespPush } = require('./index.cjs');
            const { SolidisFeaturedClient } = require('./client/featured.cjs');
            const { set } = require('./command/set.cjs');`,
          ),
        ),
      ),
      names,
    );
    assert.deepStrictEqual(
      JSON.parse(
        runNode(
          'module',
          script(
            `const { SolidisClient, SolidisCommandError, RespPush } = await import('./index.mjs');
            const { SolidisFeaturedClient } = await import('./client/featured.mjs');
            const { set } = await import('./command/set.mjs');`,
          ),
        ),
      ),
      names,
    );
  });
});

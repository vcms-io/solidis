/** Built artifacts: every published entry point must load under plain Node. */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { buildDistributions } from '../../../build/distributions.ts';

interface PackageExportTarget {
  import: { default: string };
  require: { default: string };
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

  it('points every package.json export at a file that exists', async () => {
    const packageJson = JSON.parse(
      await readFile(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { exports: Record<string, PackageExportTarget> };
    const targets = Object.values(packageJson.exports).flatMap((target) => [
      target.import.default.replace('*', 'get'),
      target.require.default.replace('*', 'get'),
    ]);
    const output = runNode(
      'commonjs',
      `const { existsSync } = require('node:fs');
      const targets = ${JSON.stringify(targets)};
      process.stdout.write(JSON.stringify(targets.filter((target) => !existsSync(target.replace('./distributions/', './')))));`,
    );

    assert.deepStrictEqual(JSON.parse(output), []);
  });
});

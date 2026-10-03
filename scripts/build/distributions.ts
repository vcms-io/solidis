import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { build } from 'esbuild';

import type { Plugin } from 'esbuild';

const inlinedModulePath = resolve('sources/common/internal.ts');

function createExternalImportPlugin(extension: string): Plugin {
  return {
    name: 'external-import',
    setup(build) {
      build.onResolve({ filter: /^\./ }, ({ path, resolveDir, kind }) => {
        if (
          kind === 'entry-point' ||
          resolve(resolveDir, path) === inlinedModulePath
        ) {
          return undefined;
        }

        return { path: path.replace(/\.ts$/, extension), external: true };
      });
    },
  } satisfies Plugin;
}

export async function buildDistributions(outputDirectory: string) {
  for (const [format, extension] of [
    ['esm', '.mjs'],
    ['cjs', '.cjs'],
  ] as const) {
    await build({
      entryPoints: ['sources/**/*.ts'],
      outdir: outputDirectory,
      bundle: true,
      format,
      minify: true,
      platform: 'node',
      outExtension: {
        '.js': extension,
      },
      plugins: [createExternalImportPlugin(extension)],
    });
  }
}

export async function buildCommonJsDeclarations(outputDirectory: string) {
  const files = await readdir(outputDirectory, { recursive: true });

  for (const file of files) {
    if (!file.endsWith('.d.ts')) {
      continue;
    }

    const path = join(outputDirectory, file);
    const contents = await readFile(path, 'utf8');

    await writeFile(
      path.replace(/\.d\.ts$/, '.d.cts'),
      contents.replace(/(['"])(\.{1,2}\/[^'"]+)\.ts\1/g, '$1$2.cts$1'),
    );
  }
}

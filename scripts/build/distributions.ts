import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { build } from 'esbuild';

import type { Plugin } from 'esbuild';

function createTransformImportExtensionPlugin(extension: string): Plugin {
  return {
    name: 'transform-import-extension',
    setup(build) {
      build.onLoad({ filter: /\.(js|ts)$/ }, async (file) => {
        const contents = await readFile(file.path, 'utf8');

        const transformedContents = contents.replace(
          /(from\s+['"])([^'"]+)\.ts(['"]\s*;?)/g,
          `$1$2${extension}$3`,
        );

        return {
          contents: transformedContents,
          loader: 'ts',
        };
      });
    },
  } satisfies Plugin;
}

export async function buildDistributions(outputDirectory: string) {
  await build({
    entryPoints: ['sources/**/*.ts'],
    outdir: outputDirectory,
    format: 'esm',
    minify: true,
    platform: 'node',
    outExtension: {
      '.js': '.mjs',
    },
    plugins: [createTransformImportExtensionPlugin('.mjs')],
  });

  await build({
    entryPoints: ['sources/**/*.ts'],
    outdir: outputDirectory,
    format: 'cjs',
    minify: true,
    platform: 'node',
    outExtension: {
      '.js': '.cjs',
    },
    plugins: [createTransformImportExtensionPlugin('.cjs')],
  });
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

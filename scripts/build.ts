import { readFile } from 'node:fs/promises';

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

await build({
  entryPoints: ['sources/**/*.ts'],
  outdir: 'distributions',
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
  outdir: 'distributions',
  format: 'cjs',
  minify: true,
  platform: 'node',
  outExtension: {
    '.js': '.cjs',
  },
  plugins: [createTransformImportExtensionPlugin('.cjs')],
});

import { isBuiltin } from 'node:module';
import { fileURLToPath } from 'node:url';

import chalk from 'chalk';
import { build } from 'esbuild';

/**
 * Jay Lee <jay@vendit.co.kr>
 * A custom ESM loader (based on esbuild) to support resolving all dependencies of pure ESM modules.
 * @see https://github.com/TypeStrong/ts-node/issues/2110
 * @see https://github.com/TypeStrong/ts-node/issues/2094
 */

const executePath = process.cwd();

async function load(url, context, defaultLoad) {
  if (isBuiltin(url)) {
    return defaultLoad(url, context, defaultLoad);
  }

  if (url.includes('node_modules')) {
    return defaultLoad(url, context, defaultLoad);
  }

  const startedAt = Date.now();
  const result = await build({
    bundle: true,
    format: 'esm',
    mainFields: ['module', 'main'],
    platform: 'node',
    minify: false,
    metafile: false,
    write: false,
    sourcemap: 'inline',
    entryPoints: [fileURLToPath(url)],
    absWorkingDir: executePath,
    external: ['esbuild'],
    packages: 'bundle',
  });
  const took = Date.now() - startedAt;

  const loaderBadge = chalk.black.bgGreen.bold` ESM Loader `;
  const chalkedUrl = chalk.gray(`"${url}"`);
  const chalkedTook = chalk.yellow.bold(`${took} ms`);

  process.stdout.write(
    `${loaderBadge} Load ${chalkedUrl} Took ${chalkedTook} ✨\n\n`,
  );

  process.stdout.write(result.errors.map((error) => error.text).join('\n'));
  process.stdout.write(
    result.warnings.map((warning) => warning.text).join('\n'),
  );

  const source = result.outputFiles[0].contents;

  return {
    format: 'module',
    source,
    shortCircuit: true,
  };
}

export { load };

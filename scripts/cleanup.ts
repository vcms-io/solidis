import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';

type DtsMap = Map<string, Buffer>;

const distributionsPath = join(process.cwd(), './distributions');
const sourcesPath = join(process.cwd(), './sources');
const tsbuildinfoPath = join(distributionsPath, 'tsconfig.tsbuildinfo');

async function hasSource(declaration: string) {
  try {
    await stat(join(sourcesPath, declaration.replace(/\.d\.ts$/, '.ts')));

    return true;
  } catch {
    return false;
  }
}

async function collectDts(directory: string) {
  const dtsMap: DtsMap = new Map();
  const files = await readdir(directory, { recursive: true });

  for (const file of files) {
    const fullPath = join(directory, file);
    const fileStatus = await stat(fullPath);

    if (
      fileStatus.isFile() &&
      file.endsWith('.d.ts') &&
      (await hasSource(file))
    ) {
      const content = await readFile(fullPath);

      dtsMap.set(fullPath, content);
    }
  }

  return dtsMap;
}

async function restoreDts(dtsMap: DtsMap) {
  for (const [path, content] of dtsMap) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
}

async function cleanup() {
  let tsbuildinfo: Buffer | undefined;

  try {
    tsbuildinfo = await readFile(tsbuildinfoPath);
  } catch {
    tsbuildinfo = undefined;
  }

  try {
    const distributionsStatus = await stat(distributionsPath).catch(
      (error: unknown) => {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          return undefined;
        }

        throw error;
      },
    );

    if (distributionsStatus?.isDirectory()) {
      const dtsMap = await collectDts(distributionsPath);

      await rm(distributionsPath, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 10,
      });

      await mkdir(distributionsPath, {
        recursive: true,
      });

      if (tsbuildinfo) {
        await writeFile(tsbuildinfoPath, tsbuildinfo);
      }

      await restoreDts(dtsMap);
    }

    process.stderr.write('✅ Cleaned up distributions\n');
  } catch (error) {
    process.stderr.write(`❌ Failed to clean up distributions: ${error}\n`);
    process.exitCode = 1;
  }
}

await cleanup();

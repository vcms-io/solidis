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
const tsbuildinfoPath = join(distributionsPath, 'tsconfig.tsbuildinfo');

async function collectDts(directory: string) {
  const dtsMap: DtsMap = new Map();

  try {
    const files = await readdir(directory, { recursive: true });

    for (const file of files) {
      const fullPath = join(directory, file);
      const fileStatus = await stat(fullPath);

      if (fileStatus.isFile() && file.endsWith('.d.ts')) {
        const content = await readFile(fullPath);

        dtsMap.set(fullPath, content);
      }
    }

    return dtsMap;
  } catch {
    return dtsMap;
  }
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
    const distributionsStatus = await stat(distributionsPath);

    if (distributionsStatus.isDirectory()) {
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

    process.stdout.write('✅ Cleaned up distributions\n');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return;
    }

    process.stderr.write(`❌ Failed to clean up distributions: ${error}\n`);
  }
}

await cleanup();

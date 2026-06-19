import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { build } from 'esbuild';

const OUTPUT_DIRECTORY = resolve('.bundle');

const ENTRY_SOLIDIS = `\
import { SolidisClient } from '../sources/client.ts';
import { get } from '../sources/command/get.ts';
import { set } from '../sources/command/set.ts';
const client = new SolidisClient();
client.extend({ get, set });
export { client };
`;

const ENTRY_IOREDIS = `\
import Redis from 'ioredis';
const client = new Redis();
await client.set('key', 'value');
await client.get('key');
export { client };
`;

const ENTRY_NODE_REDIS = `\
import { createClient } from 'redis';
const client = createClient();
await client.connect();
await client.set('key', 'value');
await client.get('key');
export { client };
`;

interface BundleTarget {
  name: string;
  entryContent: string;
  external: string[];
}

const targets: BundleTarget[] = [
  {
    name: 'solidis',
    entryContent: ENTRY_SOLIDIS,
    external: [],
  },
  {
    name: 'ioredis',
    entryContent: ENTRY_IOREDIS,
    external: [],
  },
  {
    name: 'node-redis',
    entryContent: ENTRY_NODE_REDIS,
    external: [],
  },
];

interface BundleResult {
  name: string;
  bundleBytes: number;
  sourceMapBytes: number;
}

async function bundleTarget(target: BundleTarget): Promise<BundleResult> {
  const entryPath = resolve(OUTPUT_DIRECTORY, `entry.${target.name}.ts`);
  const outputPath = resolve(OUTPUT_DIRECTORY, `${target.name}.mjs`);

  await writeFile(entryPath, target.entryContent, 'utf-8');

  const result = await build({
    entryPoints: [entryPath],
    outfile: outputPath,
    bundle: true,
    format: 'esm',
    platform: 'node',
    minify: true,
    sourcemap: true,
    sourcesContent: false,
    metafile: true,
    treeShaking: true,
    external: target.external,
  });

  const metaPath = resolve(OUTPUT_DIRECTORY, `${target.name}.meta.json`);
  await writeFile(metaPath, JSON.stringify(result.metafile, null, 2), 'utf-8');

  const outputs = result.metafile.outputs;
  let bundleBytes = 0;
  let sourceMapBytes = 0;

  for (const [outputFile, output] of Object.entries(outputs)) {
    if (outputFile.endsWith('.map')) {
      sourceMapBytes = output.bytes;
    } else {
      bundleBytes = output.bytes;
    }
  }

  return { name: target.name, bundleBytes, sourceMapBytes };
}

await rm(OUTPUT_DIRECTORY, { recursive: true, force: true });
await mkdir(OUTPUT_DIRECTORY, { recursive: true });

const results: BundleResult[] = [];

for (const target of targets) {
  const result = await bundleTarget(target);
  results.push(result);
}

const snapshotPath = resolve(OUTPUT_DIRECTORY, 'snapshot.json');
await writeFile(snapshotPath, JSON.stringify(results, null, 2), 'utf-8');

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

console.log('\nBundle Size Comparison:');
console.log('─'.repeat(56));
console.log(
  `${'Library'.padEnd(16)} ${'Bundle'.padStart(12)} ${'Source Map'.padStart(12)}`,
);
console.log('─'.repeat(56));

for (const result of results) {
  console.log(
    `${result.name.padEnd(16)} ${formatBytes(result.bundleBytes).padStart(12)} ${formatBytes(result.sourceMapBytes).padStart(12)}`,
  );
}

console.log('─'.repeat(56));
console.log(`\nSnapshot saved to: ${snapshotPath}`);

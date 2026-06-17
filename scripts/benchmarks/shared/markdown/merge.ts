import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { deserializeConfig } from '../configuration.ts';
import { generateMarkdownReport } from './index.ts';
import { loadSnapshot, mergeSnapshots } from './snapshot.ts';

const processArguments = process.argv.slice(2);
const snapshotPaths: string[] = [];
let outputPath = './benchmark.md';

for (let index = 0; index < processArguments.length; index += 1) {
  const argument = processArguments[index];

  if (argument === '--output' || argument === '-o') {
    const nextValue = processArguments[index + 1];

    if (!nextValue) {
      console.error('Missing value for --output');
      process.exit(1);
    }

    outputPath = nextValue;
    index += 1;
  } else {
    snapshotPaths.push(argument);
  }
}

if (snapshotPaths.length === 0) {
  console.error(
    'Usage: benchmark:merge <file1.benchmark> <file2.benchmark> ... [-o output.md]',
  );
  process.exit(1);
}

const snapshots = await Promise.all(
  snapshotPaths.map((path) => loadSnapshot(path)),
);

const merged = mergeSnapshots(snapshots);
const configuration = deserializeConfig(merged.configuration);
const markdown = generateMarkdownReport(
  merged.results,
  merged.baselineLibrary,
  configuration,
);

const resolvedOutputPath = resolve(outputPath);

await writeFile(resolvedOutputPath, markdown, 'utf-8');

console.log(
  `Merged ${snapshotPaths.length} snapshot(s) from suite "${merged.suiteName}"`,
);
console.log(`  Results: ${merged.results.length} entries`);
console.log(`  Output:  ${resolvedOutputPath}`);

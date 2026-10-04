import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describeFailedResults } from '../results.ts';
import { generateMarkdownReport, generateSummary } from './index.ts';
import { loadSnapshot, mergeSnapshots } from './snapshot.ts';

const outputs = new Map<string, string>();
const snapshotPaths: string[] = [];
const processArguments = process.argv.slice(2);
const options: Record<string, string> = {
  '--output': 'report',
  '-o': 'report',
  '--snapshot': 'snapshot',
  '-s': 'snapshot',
  '--summary': 'summary',
};

for (let index = 0; index < processArguments.length; index += 1) {
  const argument = processArguments[index];
  const output = options[argument];

  if (output === undefined) {
    snapshotPaths.push(argument);

    continue;
  }

  const value = processArguments[index + 1];

  if (!value) {
    console.error(`Missing value for ${argument}`);
    process.exit(1);
  }

  outputs.set(output, resolve(value));
  index += 1;
}

if (snapshotPaths.length === 0) {
  console.error(
    'Usage: benchmark:merge <file.benchmark>... [-o report.md] [-s merged.benchmark] [--summary summary.md]',
  );
  process.exit(1);
}

const merged = mergeSnapshots(
  await Promise.all(snapshotPaths.map((path) => loadSnapshot(path))),
);
const failures = describeFailedResults(merged.results);

if (failures.length > 0) {
  console.error(
    `Refusing to report failed benchmark results:\n${failures.join('\n')}`,
  );
  process.exit(1);
}

const contents: Record<string, string> = {
  report: generateMarkdownReport(merged),
  snapshot: JSON.stringify(merged, null, 2),
  summary: generateSummary(merged),
};

for (const [output, path] of outputs) {
  await writeFile(path, contents[output], 'utf-8');
  console.log(`  ${output}: ${path}`);
}

console.log(
  `Merged ${snapshotPaths.length} snapshot(s) with ${merged.results.length} results`,
);

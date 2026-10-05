import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { formatPayloadSize } from '../utils.ts';
import { analyze, findNoteNumber } from './analysis.ts';
import { en, ko } from './locales/index.ts';
import { loadSnapshot, mergeSnapshots } from './snapshot.ts';

const snapshotPaths = process.argv.slice(2);

if (snapshotPaths.length === 0) {
  console.error('Usage: benchmark:replace:website <file.benchmark>...');
  process.exit(1);
}

const merged = mergeSnapshots(
  await Promise.all(snapshotPaths.map((path) => loadSnapshot(path))),
);
const analysis = analyze(merged);
const environment = merged.environments.at(-1);
const cases = analysis.cases.filter((comparison) => comparison.lead !== null);

if (cases.length === 0) {
  console.error('No benchmark results to publish.');
  process.exit(1);
}

function round(value: number | null): number {
  return Number((value ?? 0).toFixed(1));
}

function describeCommands(operation: string): string {
  const separator = operation.indexOf(':');

  return separator === -1
    ? operation.toUpperCase()
    : operation
        .slice(separator + 1)
        .split('+')
        .join(' + ');
}

const data = {
  benchmarkClients: merged.libraries.map(({ name }) => ({ name })),
  benchmarkSummary: {
    wins: analysis.subjectWins,
    total: analysis.cases.length,
    averageLead: round(analysis.averageLead),
    peakLead: round(analysis.peakLead),
    iterations: merged.configuration.iterations,
    concurrency:
      merged.configuration.clients * merged.configuration.concurrency,
    repeats: merged.configuration.repeats,
    payload: merged.configuration.sizes.map(formatPayloadSize).join(', '),
    mode: merged.configuration.mode,
    nodeVersion: environment?.nodeVersion ?? '',
    platform: environment ? `${environment.platform} ${environment.arch}` : '',
    server: environment?.server ?? '',
  },
  benchmarkCases: cases.map((comparison) => ({
    name: {
      en:
        en.operationDisplayNames[comparison.operation] ?? comparison.operation,
      ko:
        ko.operationDisplayNames[comparison.operation] ?? comparison.operation,
    },
    commands: describeCommands(comparison.operation),
    lead: round(comparison.lead),
    clients: comparison.results.map((result) => ({
      name: result.library,
      operationsPerSecond: Math.round(result.unitsPerSecond ?? 0),
      note: findNoteNumber(analysis, result.nonComparableReason),
    })),
  })),
  benchmarkNotes: analysis.notes.map((note) => ({
    en: en.note(note),
    ko: ko.note(note),
  })),
};
const outputPath = resolve('website', 'lib', 'benchmarks.ts');

await writeFile(
  outputPath,
  `${Object.entries(data)
    .map(
      ([name, value]) =>
        `export const ${name} = ${JSON.stringify(value, null, 2)};\n`,
    )
    .join('\n')}`,
  'utf-8',
);

console.log(`Updated ${outputPath} with ${cases.length} benchmarks`);

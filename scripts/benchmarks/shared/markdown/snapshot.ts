import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { serializeConfig } from '../configuration.ts';

import type {
  BenchConfig,
  BenchmarkSnapshot,
  ComparedResult,
  LibraryName,
} from '../types.ts';

function readSnapshotPath(): string | undefined {
  return process.env.SOLIDIS_BENCH_EXPORT_SNAPSHOT?.trim() || undefined;
}

export function shouldExportSnapshot(): boolean {
  return readSnapshotPath() !== undefined;
}

export function createSnapshot(
  suiteName: string,
  baselineLibrary: LibraryName,
  configuration: BenchConfig,
  results: ComparedResult[],
): BenchmarkSnapshot {
  return {
    suiteName,
    baselineLibrary,
    configuration: serializeConfig(configuration),
    results,
    createdAt: new Date().toISOString(),
  };
}

export async function exportSnapshot(
  suiteName: string,
  baselineLibrary: LibraryName,
  configuration: BenchConfig,
  results: ComparedResult[],
): Promise<string | undefined> {
  const rawPath = readSnapshotPath();

  if (!rawPath) {
    return undefined;
  }

  const outputPath = resolve(rawPath);
  const snapshot = createSnapshot(
    suiteName,
    baselineLibrary,
    configuration,
    results,
  );

  await writeFile(outputPath, JSON.stringify(snapshot, null, 2), 'utf-8');

  return outputPath;
}

export async function loadSnapshot(
  filePath: string,
): Promise<BenchmarkSnapshot> {
  const content = await readFile(resolve(filePath), 'utf-8');

  return JSON.parse(content) as BenchmarkSnapshot;
}

export function mergeSnapshots(
  snapshots: BenchmarkSnapshot[],
): BenchmarkSnapshot {
  if (snapshots.length === 0) {
    throw new Error('No snapshots to merge');
  }

  const firstSuiteName = snapshots[0].suiteName;
  const firstBaselineLibrary = snapshots[0].baselineLibrary;

  for (const snapshot of snapshots) {
    if (snapshot.suiteName !== firstSuiteName) {
      throw new Error(
        'Cannot merge snapshots from different suites: ' +
          `"${firstSuiteName}" and "${snapshot.suiteName}"`,
      );
    }

    if (snapshot.baselineLibrary !== firstBaselineLibrary) {
      throw new Error(
        'Cannot merge snapshots with different baselines: ' +
          `"${firstBaselineLibrary}" and "${snapshot.baselineLibrary}"`,
      );
    }
  }

  const mergedResults: ComparedResult[] = [];
  const seen = new Set<string>();

  for (const snapshot of snapshots) {
    for (const result of snapshot.results) {
      const key = `${result.operation}\x00${result.payloadBytes}\x00${result.library}`;

      if (!seen.has(key)) {
        seen.add(key);
        mergedResults.push(result);
      }
    }
  }

  const latestSnapshot = snapshots.reduce((latest, current) =>
    current.createdAt > latest.createdAt ? current : latest,
  );

  return {
    suiteName: firstSuiteName,
    baselineLibrary: firstBaselineLibrary,
    configuration: latestSnapshot.configuration,
    results: mergedResults,
    createdAt: latestSnapshot.createdAt,
  };
}

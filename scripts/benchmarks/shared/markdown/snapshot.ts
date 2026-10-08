import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { serializeConfig } from '../configuration.ts';
import { describeFailedResults } from '../results.ts';

import type {
  BenchConfig,
  BenchEnvironment,
  BenchmarkSnapshot,
  BenchResult,
  LibraryInfo,
} from '../types.ts';

function readSnapshotPath(): string | undefined {
  return process.env.SOLIDIS_BENCH_EXPORT_SNAPSHOT?.trim() || undefined;
}

export function shouldExportSnapshot(): boolean {
  return readSnapshotPath() !== undefined;
}

export function createSnapshot(
  suiteName: string,
  libraries: LibraryInfo[],
  environments: BenchEnvironment[],
  configuration: BenchConfig,
  results: BenchResult[],
): BenchmarkSnapshot {
  return {
    suiteName,
    libraries,
    environments,
    configuration: serializeConfig(configuration),
    results,
    createdAt: new Date().toISOString(),
  };
}

export async function exportSnapshot(
  snapshot: BenchmarkSnapshot,
): Promise<string> {
  const outputPath = resolve(readSnapshotPath() ?? 'solidis.benchmark');

  await writeFile(outputPath, JSON.stringify(snapshot, null, 2), 'utf-8');

  return outputPath;
}

export async function loadSnapshot(
  filePath: string,
): Promise<BenchmarkSnapshot> {
  const snapshot: BenchmarkSnapshot = JSON.parse(
    await readFile(resolve(filePath), 'utf-8'),
  );

  if (
    !Array.isArray(snapshot.libraries) ||
    !Array.isArray(snapshot.environments) ||
    !Array.isArray(snapshot.results)
  ) {
    throw new Error(`${filePath} is not a snapshot of this benchmark suite`);
  }

  return snapshot;
}

export function mergeSnapshots(
  snapshots: BenchmarkSnapshot[],
): BenchmarkSnapshot {
  const [first] = snapshots;

  if (!first) {
    throw new Error('No snapshots to merge');
  }

  const libraries = new Map<string, LibraryInfo>();
  const environments = new Map<string, BenchEnvironment>();
  const results = new Map<string, BenchResult>();

  for (const snapshot of snapshots) {
    if (snapshot.suiteName !== first.suiteName) {
      throw new Error(
        `Cannot merge snapshots of "${first.suiteName}" and "${snapshot.suiteName}"`,
      );
    }

    for (const library of snapshot.libraries) {
      const known = libraries.get(library.name);

      if (known && known.version !== library.version) {
        throw new Error(
          `Cannot merge ${library.name} ${known.version} and ${library.version}`,
        );
      }

      libraries.set(library.name, library);
    }

    for (const environment of snapshot.environments) {
      environments.set(JSON.stringify(environment), environment);
    }

    for (const result of snapshot.results) {
      results.set(
        `${result.operation}\0${result.payloadBytes}\0${result.library}`,
        result,
      );
    }
  }

  const latest = snapshots.reduce((left, right) =>
    right.createdAt > left.createdAt ? right : left,
  );

  const merged: BenchmarkSnapshot = {
    suiteName: first.suiteName,
    libraries: [...libraries.values()],
    environments: [...environments.values()],
    configuration: latest.configuration,
    results: [...results.values()],
    createdAt: latest.createdAt,
  };
  const failures = describeFailedResults(merged.results);

  if (failures.length > 0) {
    throw new Error(
      `Refusing to report failed benchmark results:\n${failures.join('\n')}`,
    );
  }

  return merged;
}

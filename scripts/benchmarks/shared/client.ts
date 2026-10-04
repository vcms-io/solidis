import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';

import type {
  BenchClient,
  BenchmarkCase,
  BenchmarkMode,
  BenchmarkNote,
  Command,
  ConnectionTarget,
  LibraryName,
} from './types.ts';

const require = createRequire(import.meta.url);

export interface PubSubSubscriber {
  subscribe(channel: string): Promise<void>;
  onMessage(handler: () => void): void;
  close(): Promise<void>;
}

export function readPackageVersion(
  packageName: string,
  start = dirname(require.resolve(packageName)),
): string {
  let directory = start;

  for (;;) {
    const manifestPath = join(directory, 'package.json');

    if (existsSync(manifestPath)) {
      const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));

      if (
        typeof manifest === 'object' &&
        manifest !== null &&
        Reflect.get(manifest, 'name') === packageName
      ) {
        return String(Reflect.get(manifest, 'version'));
      }
    }

    const parent = dirname(directory);

    if (parent === directory) {
      throw new Error(`Cannot find the package.json of ${packageName}`);
    }

    directory = parent;
  }
}

export function getCommandName(command: Command): string {
  const name = command[0];

  if (typeof name !== 'string') {
    throw new Error(`Redis command name must be a string: ${name}`);
  }

  return name.toUpperCase();
}

export abstract class BenchmarkClientAdapter {
  abstract readonly name: LibraryName;
  abstract readonly packageName: string;
  readonly hasNativeCore: boolean = false;

  get version(): string {
    return readPackageVersion(this.packageName);
  }

  getUnavailableReason(): string | undefined {
    return undefined;
  }

  getNonComparableReason(
    _benchmarkCase: BenchmarkCase,
    _mode: BenchmarkMode,
  ): BenchmarkNote | undefined {
    return undefined;
  }

  abstract createBenchClient(
    target: ConnectionTarget,
    mode: BenchmarkMode,
  ): Promise<BenchClient>;

  abstract createPubSubSubscriber(
    target: ConnectionTarget,
  ): Promise<PubSubSubscriber>;

  async smokeTestPing(target: ConnectionTarget): Promise<void> {
    const client = await this.createBenchClient(target, 'batch');

    try {
      await client.ping();
    } finally {
      await client.close();
    }
  }

  async flushDb(target: ConnectionTarget): Promise<void> {
    const client = await this.createBenchClient(target, 'batch');

    try {
      await client.execute([['FLUSHDB']]);
    } finally {
      await client.close();
    }
  }

  async measurePingLatency(
    target: ConnectionTarget,
    reusableClient?: BenchClient,
  ): Promise<number> {
    const client =
      reusableClient ?? (await this.createBenchClient(target, 'batch'));
    const startedAt = performance.now();

    try {
      await client.ping();

      return performance.now() - startedAt;
    } finally {
      if (!reusableClient) {
        await client.close();
      }
    }
  }
}

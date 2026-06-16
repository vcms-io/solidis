import { performance } from 'node:perf_hooks';

import type {
  BenchClient,
  BenchmarkMode,
  ConnectionTarget,
  LibraryName,
} from './types.ts';

export interface PubSubSubscriber {
  subscribe(channel: string): Promise<void>;
  onMessage(handler: () => void): void;
  close(): Promise<void>;
}

export abstract class BenchmarkClientAdapter {
  abstract readonly name: LibraryName;

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

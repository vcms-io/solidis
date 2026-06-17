import {
  settleAbsoluteRangeMs,
  settleJitterPercent,
  settleMaxAttempts,
  settlePingSamples,
} from './constants.ts';
import { createCommandCase } from './execution.ts';
import { createSampleRunOrder } from './results.ts';
import { jitterPercent, logPhase, logWarn, sleep } from './utils.ts';

import type { BenchmarkClientAdapter } from './client.ts';
import type {
  BenchClient,
  BenchConfig,
  BenchmarkCase,
  BenchmarkMode,
  Command,
  CommandCaseOptions,
  ConnectionTarget,
  LibraryName,
} from './types.ts';

export abstract class BenchmarkSuite {
  abstract readonly name: string;
  abstract readonly baselineLibrary: LibraryName;
  abstract readonly adapters: readonly BenchmarkClientAdapter[];

  private benchmarkCaseCache?: BenchmarkCase[];

  get libraries(): readonly LibraryName[] {
    return this.adapters.map((adapter) => adapter.name);
  }

  get benchmarkCases(): BenchmarkCase[] {
    if (!this.benchmarkCaseCache) {
      this.benchmarkCaseCache = this.buildBenchmarkCases();
    }

    return this.benchmarkCaseCache;
  }

  getAdapter(library: LibraryName): BenchmarkClientAdapter {
    const adapter = this.adapters.find(
      (candidate) => candidate.name === library,
    );

    if (!adapter) {
      throw new Error(`Unknown benchmark library: ${library}`);
    }

    return adapter;
  }

  async createBenchClientPool(
    library: LibraryName,
    target: ConnectionTarget,
    mode: BenchmarkMode,
    size: number,
  ): Promise<BenchClient[]> {
    const adapter = this.getAdapter(library);

    return await Promise.all(
      Array.from({ length: size }, () =>
        adapter.createBenchClient(target, mode),
      ),
    );
  }

  async closeBenchClientPool(clients: BenchClient[]): Promise<void> {
    await Promise.all(clients.map((client) => client.close()));
  }

  commandCase(options: CommandCaseOptions): BenchmarkCase {
    return createCommandCase(this, options);
  }

  sampleRunOrder(caseIndex: number, sampleIndex: number): LibraryName[] {
    return createSampleRunOrder(this.libraries)(caseIndex, sampleIndex);
  }

  abstract getComparableModes(commands: Command[]): ReadonlySet<BenchmarkMode>;
  abstract getNonComparableReason(commands: Command[]): string | undefined;
  abstract buildBenchmarkCases(): BenchmarkCase[];
  abstract printFairnessPolicy(config: BenchConfig): void;

  async smokeTest(config: BenchConfig): Promise<void> {
    await Promise.all(
      this.adapters.map((adapter) => adapter.smokeTestPing(config.target)),
    );
  }

  async flushDb(config: BenchConfig): Promise<void> {
    await this.getAdapter(this.baselineLibrary).flushDb(config.target);
  }

  async waitForServerSettle(config: BenchConfig): Promise<void> {
    logPhase('settle', `cooldown ${config.cooldownMs}ms`);
    await sleep(config.cooldownMs);

    const settleAdapter = this.getAdapter(this.baselineLibrary);
    const client = await settleAdapter
      .createBenchClient(config.target, 'batch')
      .catch(() => undefined);

    if (!client) {
      logPhase('settle', 'probe client unavailable, extra cooldown');
      await sleep(config.cooldownMs);

      return;
    }

    try {
      for (let attempt = 0; attempt < settleMaxAttempts; attempt += 1) {
        const samples: number[] = [];

        for (let index = 0; index < settlePingSamples; index += 1) {
          samples.push(
            await settleAdapter.measurePingLatency(config.target, client),
          );
        }

        const minimum = Math.min(...samples);
        const maximum = Math.max(...samples);
        const absoluteRange = maximum - minimum;
        const measuredJitter = jitterPercent(samples);

        if (
          absoluteRange <= settleAbsoluteRangeMs ||
          measuredJitter <= settleJitterPercent
        ) {
          logPhase(
            'settle',
            `pass range=${absoluteRange.toFixed(2)}ms jitter=${measuredJitter.toFixed(1)}% (attempt ${attempt + 1})`,
          );

          return;
        }

        logPhase(
          'settle',
          `retry range=${absoluteRange.toFixed(2)}ms jitter=${measuredJitter.toFixed(1)}% (attempt ${attempt + 1}/${settleMaxAttempts})`,
        );
        await sleep(config.cooldownMs);
      }

      logPhase('settle', 'max attempts reached, proceeding');
    } catch (error) {
      logWarn(`settle skipped: ${error}`);
      await sleep(config.cooldownMs);
    } finally {
      await client.close();
    }
  }
}

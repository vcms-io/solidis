import { performance } from 'node:perf_hooks';
import {
  isMainThread,
  parentPort,
  Worker,
  workerData,
} from 'node:worker_threads';

import {
  deserializeConfig,
  readConfig,
  serializeConfig,
} from './configuration.ts';
import { createNamespace, settlePingSamples } from './constants.ts';
import { makePayloadPool, makePayloadSeed } from './payload.ts';
import {
  compare,
  getFairnessWarning,
  getSkipReason,
  makeErrorResult,
  makeResult,
  printConfig,
  printResults,
} from './results.ts';
import {
  logCaseDone,
  logCaseTitle,
  logPhase,
  logProgress,
  logSampleDone,
  logSampleStart,
  logSeparator,
  logStep,
  logWarn,
} from './utils.ts';

import type { BenchmarkSuite } from './suite.ts';
import type {
  BenchClient,
  BenchConfig,
  BenchContext,
  BenchmarkCase,
  BenchmarkMode,
  BenchResult,
  BenchWorkerData,
  CaseRunResult,
  LibraryName,
  PayloadPool,
} from './types.ts';

function isValidWorkerData(value: unknown): value is BenchWorkerData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'config' in value &&
    'benchmarkCaseName' in value &&
    'library' in value &&
    'payloadBytes' in value &&
    'caseIndex' in value &&
    'sampleIndex' in value
  );
}

function createSamplesRecord(
  libraries: readonly LibraryName[],
): Map<LibraryName, number[]> {
  const record = new Map<LibraryName, number[]>();

  for (const library of libraries) {
    record.set(library, []);
  }

  return record;
}

function getSamplesForLibrary(
  record: Map<LibraryName, number[]>,
  library: LibraryName,
): number[] {
  const samples = record.get(library);

  if (!samples) {
    throw new Error(`No samples record initialized for library: ${library}`);
  }

  return samples;
}

export function createBenchmarkRunner(
  suite: BenchmarkSuite,
  entryUrl: string | URL,
) {
  const namespace = createNamespace(suite.name);

  async function warmBenchmarkLibrary(
    config: BenchConfig,
    library: LibraryName,
    mode: BenchmarkMode,
  ): Promise<BenchClient[]> {
    const clients = await suite.createBenchClientPool(
      library,
      config.target,
      mode,
      config.clients,
    );
    const startedAt = performance.now();

    logPhase(`warming ${library}`, `mode=${mode}`);

    try {
      for (let index = 0; index < settlePingSamples; index += 1) {
        await Promise.all(clients.map((client) => client.ping()));
      }

      logPhase(
        `${library} warm`,
        `${(performance.now() - startedAt).toFixed(1)}ms`,
      );

      return clients;
    } catch (error) {
      await suite.closeBenchClientPool(clients);
      logWarn(`${library} warmup skipped: ${error}`);

      throw error;
    }
  }

  async function runCaseSample(
    config: BenchConfig,
    benchmarkCase: BenchmarkCase,
    library: LibraryName,
    payloadBytes: number,
    payloadPool: PayloadPool,
    sampleIndex: number,
  ): Promise<CaseRunResult> {
    const sampleStartedAt = performance.now();

    logSampleStart(
      benchmarkCase.name,
      library,
      sampleIndex + 1,
      config.repeats,
    );

    const executionMode = benchmarkCase.executionMode ?? config.mode;
    const clients = await warmBenchmarkLibrary(config, library, executionMode);

    const context: BenchContext = {
      config,
      library,
      payloadBytes,
      payloadPool,
      clients,
      keyPrefix: `${namespace}:${benchmarkCase.name}:${library}:${payloadBytes}:r${sampleIndex}`,
    };

    let result: CaseRunResult;

    try {
      result = await benchmarkCase.run(context);
    } finally {
      await suite.closeBenchClientPool(clients);
    }

    logSampleDone(
      benchmarkCase.name,
      library,
      sampleIndex + 1,
      config.repeats,
      result.elapsedMs,
      performance.now() - sampleStartedAt,
    );

    return result;
  }

  async function runCaseSampleSafe(
    config: BenchConfig,
    benchmarkCase: BenchmarkCase,
    library: LibraryName,
    payloadBytes: number,
    payloadPool: PayloadPool,
    sampleIndex: number,
  ): Promise<CaseRunResult> {
    try {
      return await runCaseSample(
        config,
        benchmarkCase,
        library,
        payloadBytes,
        payloadPool,
        sampleIndex,
      );
    } catch (error) {
      logWarn(`${benchmarkCase.name} [${library}] failed: ${error}`);

      throw error;
    }
  }

  async function runIsolatedCaseSample(
    config: BenchConfig,
    benchmarkCase: BenchmarkCase,
    library: LibraryName,
    payloadBytes: number,
    caseIndex: number,
    sampleIndex: number,
  ): Promise<CaseRunResult> {
    logSeparator();

    const result = await new Promise<CaseRunResult>((resolve, reject) => {
      const worker = new Worker(new URL(entryUrl), {
        workerData: {
          config: serializeConfig(config),
          benchmarkCaseName: benchmarkCase.name,
          library,
          payloadBytes,
          caseIndex,
          sampleIndex,
        } satisfies BenchWorkerData,
      });

      worker.once('message', (message: unknown) => {
        if (
          typeof message === 'object' &&
          message !== null &&
          'elapsedMs' in message &&
          typeof message.elapsedMs === 'number'
        ) {
          const verificationError =
            'verificationError' in message &&
            typeof message.verificationError === 'string'
              ? message.verificationError
              : undefined;

          resolve({ elapsedMs: message.elapsedMs, verificationError });

          return;
        }

        reject(new Error(`Unexpected benchmark worker message: ${message}`));
      });

      worker.once('error', reject);

      worker.once('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Benchmark worker exited with code ${code}`));
        }
      });
    });

    logSeparator();

    return result;
  }

  async function runComparedCase(
    config: BenchConfig,
    benchmarkCase: BenchmarkCase,
    payloadBytes: number,
    caseIndex: number,
    caseWallMilliseconds?: number,
  ): Promise<BenchResult[]> {
    const samplesMilliseconds = createSamplesRecord(suite.libraries);
    const verificationErrors = new Map<LibraryName, string>();
    const errors = new Map<LibraryName, unknown>();

    for (let sampleIndex = 0; sampleIndex < config.repeats; sampleIndex += 1) {
      for (const library of suite.sampleRunOrder(caseIndex, sampleIndex)) {
        if (errors.has(library)) {
          continue;
        }

        try {
          logPhase(
            `flush → ${benchmarkCase.name}`,
            `${library} sample ${sampleIndex + 1}/${config.repeats}`,
          );

          await suite.flushDb(config);
          await suite.waitForServerSettle(config);

          const sampleResult = await runIsolatedCaseSample(
            config,
            benchmarkCase,
            library,
            payloadBytes,
            caseIndex,
            sampleIndex,
          );

          getSamplesForLibrary(samplesMilliseconds, library).push(
            sampleResult.elapsedMs,
          );

          if (
            sampleResult.verificationError &&
            !verificationErrors.has(library)
          ) {
            verificationErrors.set(library, sampleResult.verificationError);
          }
        } catch (error) {
          errors.set(library, error);
        }
      }
    }

    return suite.libraries.map((library) => {
      const error = errors.get(library);

      if (error) {
        return makeErrorResult(
          config,
          benchmarkCase,
          library,
          payloadBytes,
          error,
          caseWallMilliseconds,
        );
      }

      const result = makeResult(
        benchmarkCase,
        config,
        library,
        payloadBytes,
        getSamplesForLibrary(samplesMilliseconds, library),
        caseWallMilliseconds,
      );

      result.verificationError = verificationErrors.get(library);

      return result;
    });
  }

  async function run(): Promise<void> {
    const config = readConfig();
    const results: BenchResult[] = [];
    const runStartedAt = performance.now();

    printConfig(config);
    suite.printFairnessPolicy(config);
    await suite.smokeTest(config);

    logStep('Suite started', 'flushing database');
    await suite.flushDb(config);

    let caseIndex = 0;

    for (const payloadBytes of config.sizes) {
      for (const benchmarkCase of suite.benchmarkCases) {
        const skipReason = getSkipReason(config, benchmarkCase);

        if (skipReason) {
          if (skipReason !== 'not requested') {
            logProgress(
              `skip ${benchmarkCase.name} payload=${payloadBytes}: ${skipReason}`,
            );
          }

          continue;
        }

        const fairnessWarning = getFairnessWarning(config, benchmarkCase);

        if (fairnessWarning) {
          logWarn(`${benchmarkCase.name}: ${fairnessWarning}`);
        }

        logCaseTitle(benchmarkCase.name, payloadBytes);
        const caseStartedAt = performance.now();

        const caseResults = await runComparedCase(
          config,
          benchmarkCase,
          payloadBytes,
          caseIndex,
        );
        const caseWallMilliseconds = performance.now() - caseStartedAt;

        for (const result of caseResults) {
          result.caseWallMs = caseWallMilliseconds;
        }

        logCaseDone(benchmarkCase.name, payloadBytes, caseWallMilliseconds);

        results.push(...caseResults);

        caseIndex += 1;
      }
    }

    const compared = compare(results, suite.baselineLibrary);

    printResults(compared, suite.baselineLibrary);
    logStep(
      'Suite complete',
      `total ${((performance.now() - runStartedAt) / 1000).toFixed(1)}s`,
    );
  }

  async function runWorker(): Promise<void> {
    if (!isValidWorkerData(workerData)) {
      throw new Error('Invalid worker data received');
    }

    const data = workerData;
    const config = deserializeConfig(data.config);
    const benchmarkCase = suite.benchmarkCases.find(
      (candidate) => candidate.name === data.benchmarkCaseName,
    );

    if (!benchmarkCase) {
      throw new Error(`Unknown benchmark case: ${data.benchmarkCaseName}`);
    }

    const payloadPool = makePayloadPool(
      data.payloadBytes,
      config.warmup + config.iterations,
      benchmarkCase.payloadSlotsPerUnit,
      makePayloadSeed(data.payloadBytes, data.caseIndex),
    );
    const result = await runCaseSampleSafe(
      config,
      benchmarkCase,
      data.library,
      data.payloadBytes,
      payloadPool,
      data.sampleIndex,
    );

    parentPort?.postMessage({
      elapsedMs: result.elapsedMs,
      verificationError: result.verificationError,
    });
  }

  const entrypoint = isMainThread ? run : runWorker;

  return { run, runWorker, entrypoint };
}

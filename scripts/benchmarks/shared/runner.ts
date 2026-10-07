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
import { captureEnvironment } from './environment.ts';
import {
  exportMarkdownReport,
  shouldExportMarkdown,
} from './markdown/index.ts';
import { en } from './markdown/locales/index.ts';
import {
  createSnapshot,
  exportSnapshot,
  shouldExportSnapshot,
} from './markdown/snapshot.ts';
import { makePayloadPool, makePayloadSeed } from './payload.ts';
import {
  createSampleRunOrder,
  describeFailedResults,
  getSkipReason,
  makeErrorResult,
  makeResult,
  printConfig,
  printResults,
} from './results.ts';
import {
  ansi,
  logCaseDone,
  logCaseTitle,
  logError,
  logPhase,
  logProgress,
  logSampleDone,
  logSampleStart,
  logSeparator,
  logStep,
  logSuccess,
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

function readWorkerResult(message: unknown): CaseRunResult {
  if (
    typeof message === 'object' &&
    message !== null &&
    'elapsedMs' in message &&
    typeof message.elapsedMs === 'number' &&
    'cpuMicroseconds' in message &&
    typeof message.cpuMicroseconds === 'number' &&
    'gcMilliseconds' in message &&
    typeof message.gcMilliseconds === 'number' &&
    'peakMemoryBytes' in message &&
    typeof message.peakMemoryBytes === 'number' &&
    'latenciesMilliseconds' in message &&
    message.latenciesMilliseconds instanceof Float64Array
  ) {
    return {
      elapsedMs: message.elapsedMs,
      cpuMicroseconds: message.cpuMicroseconds,
      gcMilliseconds: message.gcMilliseconds,
      peakMemoryBytes: message.peakMemoryBytes,
      latenciesMilliseconds: message.latenciesMilliseconds,
      verificationError:
        'verificationError' in message &&
        typeof message.verificationError === 'string'
          ? message.verificationError
          : undefined,
    };
  }

  throw new Error(`Unexpected benchmark worker message: ${message}`);
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

    const clients = await warmBenchmarkLibrary(
      config,
      library,
      benchmarkCase.executionMode ?? config.mode,
    );
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
        try {
          resolve(readWorkerResult(message));
        } catch (error) {
          reject(error);
        }
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
    libraries: readonly LibraryName[],
  ): Promise<BenchResult[]> {
    const samples = new Map<LibraryName, CaseRunResult[]>(
      libraries.map((library) => [library, []]),
    );
    const errors = new Map<LibraryName, unknown>();
    const caseStartedAt = performance.now();

    for (let sampleIndex = 0; sampleIndex < config.repeats; sampleIndex += 1) {
      for (const library of createSampleRunOrder(
        libraries,
        caseIndex,
        sampleIndex,
      )) {
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

          samples
            .get(library)
            ?.push(
              await runIsolatedCaseSample(
                config,
                benchmarkCase,
                library,
                payloadBytes,
                caseIndex,
                sampleIndex,
              ),
            );
        } catch (error) {
          errors.set(library, error);
        }
      }
    }

    const caseWallMilliseconds = performance.now() - caseStartedAt;
    const mode = benchmarkCase.executionMode ?? config.mode;

    return libraries.map((library) => {
      const nonComparableReason = suite.getNonComparableReason(
        benchmarkCase,
        library,
        mode,
      );

      return errors.has(library)
        ? makeErrorResult(
            benchmarkCase,
            config,
            library,
            payloadBytes,
            errors.get(library),
            nonComparableReason,
            caseWallMilliseconds,
          )
        : makeResult(
            benchmarkCase,
            config,
            library,
            payloadBytes,
            samples.get(library) ?? [],
            nonComparableReason,
            caseWallMilliseconds,
          );
    });
  }

  async function run(): Promise<void> {
    const config = readConfig();
    const unknownOperations = [...(config.operations ?? [])].filter(
      (operation) =>
        !suite.benchmarkCases.some(
          (benchmarkCase) => benchmarkCase.name === operation,
        ),
    );

    if (unknownOperations.length > 0) {
      throw new Error(
        `Unknown benchmark case: ${unknownOperations.join(', ')}. Cases: ${suite.benchmarkCases.map((benchmarkCase) => benchmarkCase.name).join(', ')}`,
      );
    }

    const libraries = suite.resolveLibraries(config);
    const results: BenchResult[] = [];
    const runStartedAt = performance.now();

    printConfig(config, libraries);

    console.log(`  ${ansi.dim}Fairness policy:${ansi.reset}`);

    for (const line of suite.describeFairness()) {
      console.log(`  ${ansi.dim}  • ${line}${ansi.reset}`);
    }

    console.log('');

    await suite.smokeTest(config, libraries);

    const environment = captureEnvironment(await suite.readServerInfo(config));

    logStep('Suite started', `${environment.server}, flushing database`);
    await suite.flushDb(config);

    let caseIndex = 0;

    for (const size of config.sizes) {
      for (const benchmarkCase of suite.benchmarkCases) {
        const payloadBytes = benchmarkCase.payloadSlotsPerUnit ? size : 0;

        if (
          getSkipReason(config, benchmarkCase) ||
          (!payloadBytes && size !== config.sizes[0])
        ) {
          continue;
        }

        logCaseTitle(benchmarkCase.name, payloadBytes);

        const caseResults = await runComparedCase(
          config,
          benchmarkCase,
          payloadBytes,
          caseIndex,
          libraries,
        );

        logCaseDone(
          benchmarkCase.name,
          payloadBytes,
          caseResults[0]?.caseWallMs ?? 0,
        );

        for (const result of caseResults) {
          if (result.nonComparableReason) {
            logProgress(
              `${benchmarkCase.name} [${result.library}] not strictly comparable: ${en.note(result.nonComparableReason)}`,
            );
          }
        }

        results.push(...caseResults);
        caseIndex += 1;
      }
    }

    printResults(results, suite.subjectLibrary);

    const snapshot = createSnapshot(
      suite.name,
      libraries.map((library) => {
        const { name, packageName, version, hasNativeCore } =
          suite.getAdapter(library);

        return { name, packageName, version, hasNativeCore };
      }),
      [environment],
      config,
      results,
    );

    if (shouldExportSnapshot()) {
      logSuccess(
        `Benchmark snapshot exported → ${await exportSnapshot(snapshot)}`,
      );
    }

    if (shouldExportMarkdown()) {
      logSuccess(
        `Markdown report exported → ${await exportMarkdownReport(snapshot)}`,
      );
    }

    logStep(
      'Suite complete',
      `total ${((performance.now() - runStartedAt) / 1000).toFixed(1)}s`,
    );

    const failures = describeFailedResults(results);

    for (const failure of failures) {
      logError(failure);
    }

    if (failures.length > 0) {
      process.exitCode = 1;
    }
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

    try {
      const result = await runCaseSample(
        config,
        benchmarkCase,
        data.library,
        data.payloadBytes,
        payloadPool,
        data.sampleIndex,
      );

      parentPort?.postMessage(result);
    } catch (error) {
      logWarn(`${benchmarkCase.name} [${data.library}] failed: ${error}`);

      throw error;
    }
  }

  const entrypoint = isMainThread ? run : runWorker;

  return { run, runWorker, entrypoint };
}

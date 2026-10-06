import { en } from './markdown/locales/index.ts';
import {
  ansi,
  formatLargeNumber,
  formatMemory,
  formatPayloadSize,
  median,
  percentile,
  sortPooledSamples,
  spreadPercent,
  stripAnsiEscapes,
} from './utils.ts';

import type {
  BenchConfig,
  BenchmarkCase,
  BenchmarkMode,
  BenchmarkNote,
  BenchResult,
  CaseRunResult,
  LibraryName,
} from './types.ts';

function getEffectiveMode(
  config: BenchConfig,
  benchmarkCase: BenchmarkCase,
): BenchmarkMode {
  return benchmarkCase.executionMode ?? config.mode;
}

function describeCase(
  benchmarkCase: BenchmarkCase,
  config: BenchConfig,
  library: LibraryName,
  payloadBytes: number,
  nonComparableReason: BenchmarkNote | undefined,
  caseWallMilliseconds: number | undefined,
) {
  return {
    operation: benchmarkCase.name,
    library,
    mode: getEffectiveMode(config, benchmarkCase),
    payloadBytes,
    iterations: config.iterations,
    clients: config.clients,
    concurrency: config.concurrency,
    totalConcurrency: config.clients * config.concurrency,
    caseWallMs: caseWallMilliseconds,
    comparable: nonComparableReason === undefined,
    nonComparableReason,
  };
}

export function makeResult(
  benchmarkCase: BenchmarkCase,
  config: BenchConfig,
  library: LibraryName,
  payloadBytes: number,
  samples: CaseRunResult[],
  nonComparableReason: BenchmarkNote | undefined,
  caseWallMilliseconds?: number,
): BenchResult {
  const samplesMilliseconds = samples.map((sample) => sample.elapsedMs);
  const elapsedMilliseconds = median(samplesMilliseconds);
  const latenciesMilliseconds = sortPooledSamples(
    samples.map((sample) => sample.latenciesMilliseconds),
  );
  const unitsPerSecond = median(
    samplesMilliseconds.map(
      (milliseconds) => config.iterations / (milliseconds / 1000),
    ),
  );

  return {
    ...describeCase(
      benchmarkCase,
      config,
      library,
      payloadBytes,
      nonComparableReason,
      caseWallMilliseconds,
    ),
    commandsPerUnit: benchmarkCase.commandsPerUnit,
    elapsedMs: elapsedMilliseconds,
    spreadPercent: spreadPercent(samplesMilliseconds, elapsedMilliseconds),
    latencyPercentile50Milliseconds: percentile(latenciesMilliseconds, 50),
    latencyPercentile95Milliseconds: percentile(latenciesMilliseconds, 95),
    latencyPercentile99Milliseconds: percentile(latenciesMilliseconds, 99),
    latencyPercentile999Milliseconds: percentile(latenciesMilliseconds, 99.9),
    cpuMicrosecondsPerUnit:
      median(samples.map((sample) => sample.cpuMicroseconds)) /
      config.iterations,
    gcMicrosecondsPerUnit:
      (median(samples.map((sample) => sample.gcMilliseconds)) * 1000) /
      config.iterations,
    peakMemoryBytes: median(samples.map((sample) => sample.peakMemoryBytes)),
    unitsPerSecond,
    commandsPerSecond: unitsPerSecond * benchmarkCase.commandsPerUnit,
    samplesMs: samplesMilliseconds,
    verificationError: samples.find((sample) => sample.verificationError)
      ?.verificationError,
  };
}

export function makeErrorResult(
  benchmarkCase: BenchmarkCase,
  config: BenchConfig,
  library: LibraryName,
  payloadBytes: number,
  error: unknown,
  nonComparableReason: BenchmarkNote | undefined,
  caseWallMilliseconds?: number,
): BenchResult {
  return {
    ...describeCase(
      benchmarkCase,
      config,
      library,
      payloadBytes,
      nonComparableReason,
      caseWallMilliseconds,
    ),
    commandsPerUnit: 0,
    elapsedMs: null,
    spreadPercent: null,
    unitsPerSecond: null,
    commandsPerSecond: null,
    samplesMs: [],
    error: error instanceof Error ? error.message : String(error),
  };
}

export function describeFailedResults(results: BenchResult[]): string[] {
  return results.flatMap((result) => {
    const failure = result.error ?? result.verificationError;

    return failure === undefined
      ? []
      : [
          `${result.operation} [${result.library}] ${formatPayloadSize(result.payloadBytes)}: ${failure}`,
        ];
  });
}

export function groupResults(results: BenchResult[]): BenchResult[][] {
  const groups = new Map<string, BenchResult[]>();

  for (const result of results) {
    const key = `${result.operation}\0${result.payloadBytes}`;

    groups.set(key, [...(groups.get(key) ?? []), result]);
  }

  return [...groups.values()];
}

function padRight(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - stripAnsiEscapes(text).length));
}

function padLeft(text: string, width: number): string {
  return ' '.repeat(Math.max(0, width - stripAnsiEscapes(text).length)) + text;
}

const DISPLAY_LINE_WIDTH = 70;

export function printConfig(
  config: BenchConfig,
  libraries: readonly LibraryName[],
): void {
  const line = '─'.repeat(DISPLAY_LINE_WIDTH);
  const entries: [string, string][] = [
    ['Target', `${config.target.host}:${config.target.port}`],
    ['Libraries', libraries.join(', ')],
    ['Mode', config.mode],
    ['Payload Sizes', config.sizes.map(formatPayloadSize).join(', ')],
    ['Iterations', config.iterations.toLocaleString()],
    ['Warmup', config.warmup.toLocaleString()],
    ['Clients', `${config.clients}`],
    ['Concurrency/Client', `${config.concurrency}`],
    ['Repeats', `${config.repeats}`],
    ['Cooldown', `${config.cooldownMs}ms`],
  ];

  if (config.operations) {
    entries.push(['Operations', Array.from(config.operations).join(', ')]);
  }

  console.log('');
  console.log(`${ansi.dim}${line}${ansi.reset}`);
  console.log(`${ansi.bold}${ansi.cyan}  BENCHMARK CONFIGURATION${ansi.reset}`);
  console.log(`${ansi.dim}${line}${ansi.reset}`);

  for (const [key, value] of entries) {
    console.log(
      `  ${ansi.dim}${key.padEnd(20)}${ansi.reset} ${ansi.white}${value}${ansi.reset}`,
    );
  }

  console.log(`${ansi.dim}${line}${ansi.reset}`);
  console.log('');
}

function formatLatency(milliseconds: number | undefined): string {
  return milliseconds === undefined ? '—' : `${milliseconds.toFixed(2)}ms`;
}

export function printResults(
  results: BenchResult[],
  subjectLibrary: LibraryName,
): void {
  const line = '═'.repeat(DISPLAY_LINE_WIDTH);
  const columns: [string, number][] = [
    ['library', 14],
    ['ops/s', 10],
    ['p50', 9],
    ['p99', 9],
    ['cpu/op', 9],
    ['gc/op', 9],
    ['memory', 10],
    ['spread', 8],
    [`vs ${subjectLibrary}`, 12],
  ];

  console.log('');
  console.log(`${ansi.bold}${ansi.cyan}${line}${ansi.reset}`);
  console.log(`${ansi.bold}${ansi.cyan}  RESULTS${ansi.reset}`);
  console.log(`${ansi.bold}${ansi.cyan}${line}${ansi.reset}`);

  for (const group of groupResults(results)) {
    const [first] = group;
    const subject = group.find((result) => result.library === subjectLibrary);
    const ranked = [...group].sort(
      (left, right) =>
        (right.unitsPerSecond ?? -1) - (left.unitsPerSecond ?? -1),
    );

    console.log('');
    console.log(
      `  ${ansi.bold}${ansi.white}${first.operation}${ansi.reset} ${ansi.dim}(${formatPayloadSize(first.payloadBytes)}${first.nonComparableReason ? `, not strictly comparable: ${en.note(first.nonComparableReason)}` : ''})${ansi.reset}`,
    );
    console.log(
      `  ${ansi.dim}${columns.map(([title, width], index) => (index === 0 ? padRight(title, width) : padLeft(title, width))).join(' ')}${ansi.reset}`,
    );

    for (const result of ranked) {
      if (result.error) {
        console.log(
          `  ${padRight(result.library, 14)} ${ansi.red}ERROR: ${result.error}${ansi.reset}`,
        );

        continue;
      }

      const ratio =
        subject?.unitsPerSecond && result.unitsPerSecond
          ? subject.unitsPerSecond / result.unitsPerSecond
          : undefined;
      const cells = [
        padRight(
          result.library === subjectLibrary
            ? `${ansi.magenta}${result.library}${ansi.reset}`
            : result.library,
          14,
        ),
        padLeft(formatLargeNumber(result.unitsPerSecond ?? 0), 10),
        padLeft(formatLatency(result.latencyPercentile50Milliseconds), 9),
        padLeft(formatLatency(result.latencyPercentile99Milliseconds), 9),
        padLeft(
          result.cpuMicrosecondsPerUnit === undefined
            ? '—'
            : `${result.cpuMicrosecondsPerUnit.toFixed(2)}µs`,
          9,
        ),
        padLeft(
          result.gcMicrosecondsPerUnit === undefined
            ? '—'
            : `${result.gcMicrosecondsPerUnit.toFixed(2)}µs`,
          9,
        ),
        padLeft(
          result.peakMemoryBytes === undefined
            ? '—'
            : formatMemory(result.peakMemoryBytes),
          10,
        ),
        padLeft(`±${(result.spreadPercent ?? 0).toFixed(1)}%`, 8),
        padLeft(
          result.library === subjectLibrary || ratio === undefined
            ? '—'
            : `${ratio >= 1 ? ansi.green : ansi.red}${ratio.toFixed(2)}x${ansi.reset}`,
          12,
        ),
      ];
      const verificationNote = result.verificationError
        ? ` ${ansi.yellow}⚠ ${result.verificationError}${ansi.reset}`
        : '';

      console.log(`  ${cells.join(' ')}${verificationNote}`);
    }
  }

  console.log('');
  console.log(`${ansi.bold}${ansi.cyan}${line}${ansi.reset}`);
  console.log('');
}

export function getSkipReason(
  config: BenchConfig,
  benchmarkCase: BenchmarkCase,
): string | undefined {
  if (config.operations && !config.operations.has(benchmarkCase.name)) {
    return 'not requested';
  }

  return undefined;
}

export function createSampleRunOrder(
  libraries: readonly LibraryName[],
  caseIndex: number,
  sampleIndex: number,
): LibraryName[] {
  const shift = (caseIndex + sampleIndex) % Math.max(1, libraries.length);

  return [...libraries.slice(shift), ...libraries.slice(0, shift)];
}

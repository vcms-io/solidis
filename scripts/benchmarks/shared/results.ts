import {
  ansi,
  formatLargeNumber,
  formatPayloadSize,
  median,
  spreadPercent,
  stripAnsiEscapes,
} from './utils.ts';

import type {
  BenchConfig,
  BenchmarkCase,
  BenchmarkMode,
  BenchResult,
  ComparedResult,
  LibraryName,
} from './types.ts';

function getEffectiveMode(
  config: BenchConfig,
  benchmarkCase: BenchmarkCase,
): BenchmarkMode {
  return benchmarkCase.executionMode ?? config.mode;
}

function getComparabilityMode(config: BenchConfig): BenchmarkMode {
  return config.mode;
}

function getNonComparableReason(benchmarkCase: BenchmarkCase): string {
  return (
    benchmarkCase.nonComparableReason ??
    'benchmark mode is not marked strictly comparable by this suite'
  );
}

export function makeResult(
  benchmarkCase: BenchmarkCase,
  config: BenchConfig,
  library: LibraryName,
  payloadBytes: number,
  samplesMilliseconds: number[],
  caseWallMilliseconds?: number,
): BenchResult {
  const mode = getEffectiveMode(config, benchmarkCase);
  const comparabilityMode = getComparabilityMode(config);
  const elapsedMilliseconds = median(samplesMilliseconds);
  const unitsPerSecond = config.iterations / (elapsedMilliseconds / 1000);
  const comparable = benchmarkCase.comparableModes.has(comparabilityMode);

  return {
    operation: benchmarkCase.name,
    library,
    mode,
    payloadBytes,
    iterations: config.iterations,
    clients: config.clients,
    concurrency: config.concurrency,
    totalConcurrency: config.clients * config.concurrency,
    commandsPerUnit: benchmarkCase.commandsPerUnit,
    elapsedMs: elapsedMilliseconds,
    spreadPercent: spreadPercent(samplesMilliseconds, elapsedMilliseconds),
    unitsPerSecond,
    commandsPerSecond: unitsPerSecond * benchmarkCase.commandsPerUnit,
    samplesMs: samplesMilliseconds,
    caseWallMs: caseWallMilliseconds,
    comparable,
    nonComparableReason: comparable
      ? undefined
      : getNonComparableReason(benchmarkCase),
  };
}

export function makeErrorResult(
  config: BenchConfig,
  benchmarkCase: BenchmarkCase,
  library: LibraryName,
  payloadBytes: number,
  error: unknown,
  caseWallMilliseconds?: number,
): BenchResult {
  const mode = getEffectiveMode(config, benchmarkCase);
  const comparabilityMode = getComparabilityMode(config);
  const comparable = benchmarkCase.comparableModes.has(comparabilityMode);

  return {
    operation: benchmarkCase.name,
    library,
    mode,
    payloadBytes,
    iterations: config.iterations,
    clients: config.clients,
    concurrency: config.concurrency,
    totalConcurrency: config.clients * config.concurrency,
    commandsPerUnit: 0,
    elapsedMs: null,
    spreadPercent: null,
    unitsPerSecond: null,
    commandsPerSecond: null,
    samplesMs: [],
    caseWallMs: caseWallMilliseconds,
    comparable,
    nonComparableReason: comparable
      ? undefined
      : getNonComparableReason(benchmarkCase),
    error: error instanceof Error ? error.message : String(error),
  };
}

export function compare(
  results: BenchResult[],
  baselineLibrary: LibraryName,
): ComparedResult[] {
  const baselines = new Map<string, BenchResult>();

  for (const result of results) {
    if (result.library === baselineLibrary && result.unitsPerSecond !== null) {
      baselines.set(`${result.operation}:${result.payloadBytes}`, result);
    }
  }

  return results.map((result) => {
    const baseline = baselines.get(
      `${result.operation}:${result.payloadBytes}`,
    );
    const baselineUnitsPerSecond = baseline?.unitsPerSecond ?? null;
    const ratioVsBaseline =
      result.unitsPerSecond !== null && baselineUnitsPerSecond !== null
        ? result.unitsPerSecond / baselineUnitsPerSecond
        : null;

    return {
      ...result,
      baselineLibrary,
      baselineUnitsPerSecond,
      ratioVsBaseline,
    };
  });
}

function padRight(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - stripAnsiEscapes(text).length));
}

function padLeft(text: string, width: number): string {
  return ' '.repeat(Math.max(0, width - stripAnsiEscapes(text).length)) + text;
}

const COLUMN_LIBRARY = 12;
const COLUMN_OPERATIONS = 12;
const COLUMN_COMMANDS = 12;
const COLUMN_ELAPSED = 10;
const COLUMN_SPREAD = 8;
const COLUMN_RATIO = 14;

const DISPLAY_LINE_WIDTH = 70;

export function printConfig(config: BenchConfig): void {
  const line = '─'.repeat(DISPLAY_LINE_WIDTH);
  const entries: [string, string][] = [
    ['Target', `${config.target.host}:${config.target.port}`],
    ['Mode', config.mode],
    ['Payload Sizes', config.sizes.map(formatPayloadSize).join(', ')],
    ['Iterations', config.iterations.toLocaleString()],
    ['Warmup', config.warmup.toLocaleString()],
    ['Clients', `${config.clients}`],
    ['Concurrency/Client', `${config.concurrency}`],
    ['Total Concurrency', `${config.clients * config.concurrency}`],
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

function formatPerformanceIndicator(ratio: number): string {
  if (ratio >= 1.6) {
    return ' 🔥🔥';
  }

  if (ratio >= 1.3) {
    return ' 🔥';
  }

  if (ratio > 1.0) {
    return ' ⚡️';
  }

  return '';
}

function formatRatioText(
  result: ComparedResult,
  baselineLibrary: LibraryName,
): string {
  if (result.ratioVsBaseline === null) {
    return `${ansi.dim}—${ansi.reset}`;
  }

  if (result.library === baselineLibrary) {
    return `${ansi.dim}baseline${ansi.reset}`;
  }

  const percentChange = Math.round((result.ratioVsBaseline - 1) * 100);
  const indicator = formatPerformanceIndicator(result.ratioVsBaseline);

  if (percentChange > 0) {
    const text = `+${percentChange}%`;
    const color =
      result.ratioVsBaseline >= 1.5 ? `${ansi.bold}${ansi.green}` : ansi.green;

    return `${color}${text}${ansi.reset}${indicator}`;
  }

  if (percentChange < -20) {
    return `${ansi.red}${percentChange}%${ansi.reset}`;
  }

  return `${ansi.dim}${percentChange}%${ansi.reset}`;
}

function printResultRow(
  result: ComparedResult,
  baselineLibrary: LibraryName,
): void {
  if (result.error) {
    const libraryText = `${ansi.magenta}${result.library}${ansi.reset}`;

    console.log(
      `  ${padRight(libraryText, COLUMN_LIBRARY)} ${ansi.red}ERROR: ${result.error}${ansi.reset}`,
    );

    return;
  }

  const operationsText =
    result.unitsPerSecond !== null
      ? formatLargeNumber(result.unitsPerSecond)
      : '—';
  const commandsText =
    result.commandsPerSecond !== null
      ? formatLargeNumber(result.commandsPerSecond)
      : '—';
  const elapsedText =
    result.elapsedMs !== null ? `${result.elapsedMs.toFixed(0)}ms` : '—';
  const spreadText =
    result.spreadPercent !== null
      ? `±${result.spreadPercent.toFixed(1)}%`
      : '—';
  const ratioText = formatRatioText(result, baselineLibrary);

  const libraryColor =
    result.library === baselineLibrary ? ansi.dim : ansi.magenta;
  const libraryText = `${libraryColor}${result.library}${ansi.reset}`;

  const verificationNote = result.verificationError
    ? ` ${ansi.yellow}⚠ ${result.verificationError}${ansi.reset}`
    : '';

  console.log(
    `  ${padRight(libraryText, COLUMN_LIBRARY)} ` +
      `${padLeft(operationsText, COLUMN_OPERATIONS)} ` +
      `${padLeft(commandsText, COLUMN_COMMANDS)} ` +
      `${padLeft(elapsedText, COLUMN_ELAPSED)} ` +
      `${padLeft(spreadText, COLUMN_SPREAD)} ` +
      `${padLeft(ratioText, COLUMN_RATIO)}` +
      `${verificationNote}`,
  );
}

interface ResultGroup {
  operation: string;
  payloadBytes: number;
  comparable: boolean;
  maximumRatio: number;
  results: ComparedResult[];
}

function getMaximumRatioForGroup(group: ComparedResult[]): number {
  let maximum = 0;

  for (const result of group) {
    if (result.ratioVsBaseline !== null && result.ratioVsBaseline > maximum) {
      maximum = result.ratioVsBaseline;
    }
  }

  return maximum;
}

function buildSortedResultGroups(results: ComparedResult[]): ResultGroup[] {
  const GROUP_KEY_SEPARATOR = '\x00';
  const grouped = new Map<string, ComparedResult[]>();

  for (const result of results) {
    const key = `${result.operation}${GROUP_KEY_SEPARATOR}${result.payloadBytes}`;
    const existing = grouped.get(key) ?? [];
    existing.push(result);
    grouped.set(key, existing);
  }

  const groups: ResultGroup[] = [];

  for (const [key, groupResults] of grouped) {
    const [operation, payloadText] = key.split(GROUP_KEY_SEPARATOR);
    const isComparable = groupResults.every((result) => result.comparable);

    groups.push({
      operation,
      payloadBytes: Number(payloadText),
      comparable: isComparable,
      maximumRatio: getMaximumRatioForGroup(groupResults),
      results: groupResults,
    });
  }

  const comparableGroups = groups
    .filter((group) => group.comparable)
    .sort((left, right) => right.maximumRatio - left.maximumRatio);

  const nonComparableGroups = groups
    .filter((group) => !group.comparable)
    .sort((left, right) => right.maximumRatio - left.maximumRatio);

  return [...comparableGroups, ...nonComparableGroups];
}

function printResultsTableHeader(): void {
  console.log('');
  console.log(
    `  ${ansi.dim}${padRight('library', COLUMN_LIBRARY)} ` +
      `${padLeft('operations/s', COLUMN_OPERATIONS)} ` +
      `${padLeft('commands/s', COLUMN_COMMANDS)} ` +
      `${padLeft('elapsed', COLUMN_ELAPSED)} ` +
      `${padLeft('spread', COLUMN_SPREAD)} ` +
      `${padLeft('vs base', COLUMN_RATIO)}${ansi.reset}`,
  );
  console.log(
    `  ${ansi.dim}` +
      `${'─'.repeat(COLUMN_LIBRARY)} ` +
      `${'─'.repeat(COLUMN_OPERATIONS)} ` +
      `${'─'.repeat(COLUMN_COMMANDS)} ` +
      `${'─'.repeat(COLUMN_ELAPSED)} ` +
      `${'─'.repeat(COLUMN_SPREAD)} ` +
      `${'─'.repeat(COLUMN_RATIO)}${ansi.reset}`,
  );
}

export function printResults(
  results: ComparedResult[],
  baselineLibrary: LibraryName,
): void {
  if (results.length === 0) {
    return;
  }

  const line = '═'.repeat(DISPLAY_LINE_WIDTH);

  console.log('');
  console.log(`${ansi.bold}${ansi.cyan}${line}${ansi.reset}`);
  console.log(
    `${ansi.bold}${ansi.cyan}  RESULTS  ${ansi.reset}${ansi.dim}(baseline: ${baselineLibrary})${ansi.reset}`,
  );
  console.log(`${ansi.bold}${ansi.cyan}${line}${ansi.reset}`);

  const sortedGroups = buildSortedResultGroups(results);
  const hasComparable = sortedGroups.some((group) => group.comparable);
  const hasNonComparable = sortedGroups.some((group) => !group.comparable);
  let printedNonComparableHeader = false;

  printResultsTableHeader();

  for (const group of sortedGroups) {
    if (!group.comparable && !printedNonComparableHeader && hasComparable) {
      console.log('');
      console.log(
        `  ${ansi.dim}${'┄'.repeat(DISPLAY_LINE_WIDTH - 4)}${ansi.reset}`,
      );
      console.log(`  ${ansi.dim}not strictly comparable${ansi.reset}`);
      printedNonComparableHeader = true;
    }

    console.log('');
    console.log(
      `  ${ansi.bold}${ansi.white}${group.operation}${ansi.reset} ${ansi.dim}(${formatPayloadSize(group.payloadBytes)})${ansi.reset}`,
    );

    for (const result of group.results) {
      printResultRow(result, baselineLibrary);
    }
  }

  if (hasNonComparable && hasComparable) {
    console.log('');
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

export function getFairnessWarning(
  config: BenchConfig,
  benchmarkCase: BenchmarkCase,
): string | undefined {
  if (config.operations && !config.operations.has(benchmarkCase.name)) {
    return undefined;
  }

  const mode = getComparabilityMode(config);

  if (benchmarkCase.comparableModes.has(mode)) {
    return undefined;
  }

  return `not strictly comparable in ${mode} mode: ${getNonComparableReason(benchmarkCase)}`;
}

export function createSampleRunOrder(
  libraries: readonly LibraryName[],
): (caseIndex: number, sampleIndex: number) => LibraryName[] {
  return (caseIndex: number, sampleIndex: number) => {
    const ordered = [...libraries];

    if ((caseIndex + sampleIndex) % 2 === 1) {
      ordered.reverse();
    }

    return ordered;
  };
}

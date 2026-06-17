import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { formatLargeNumber, formatPayloadSize } from '../utils.ts';

import type { BenchConfig, ComparedResult, LibraryName } from '../types.ts';

interface ResultGroup {
  operation: string;
  payloadBytes: number;
  comparable: boolean;
  maximumRatio: number;
  results: ComparedResult[];
}

function getNonBaselineRatio(group: ComparedResult[]): number {
  for (const result of group) {
    if (
      result.library !== result.baselineLibrary &&
      result.ratioVsBaseline !== null
    ) {
      return result.ratioVsBaseline;
    }
  }

  return 0;
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

    groups.push({
      operation,
      payloadBytes: Number(payloadText),
      comparable: groupResults.every((result) => result.comparable),
      maximumRatio: getNonBaselineRatio(groupResults),
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

function findSolidisLibrary(results: ComparedResult[]): LibraryName {
  for (const result of results) {
    if (result.library === 'solidis') {
      return result.library;
    }
  }

  return results[0]?.library ?? 'solidis';
}

function formatPercentChange(ratio: number | null): string {
  if (ratio === null) {
    return '-';
  }

  const percentChange = Math.round((ratio - 1) * 100);

  if (percentChange > 0) {
    return `+${percentChange}%`;
  }

  return `${percentChange}%`;
}

function getPerformanceBadge(ratio: number | null): string {
  if (ratio === null) {
    return '';
  }

  if (ratio >= 1.6) {
    return ' 🔥🔥';
  }

  if (ratio >= 1.3) {
    return ' 🔥';
  }

  if (ratio > 1.05) {
    return ' ⚡️';
  }

  return '';
}

function getRankMedal(rank: number): string {
  if (rank === 1) {
    return '🥇';
  }
  if (rank === 2) {
    return '🥈';
  }
  if (rank === 3) {
    return '🥉';
  }

  return `${rank}.`;
}

function makeProgressBar(ratio: number | null, maximumRatio: number): string {
  if (ratio === null || ratio <= 1) {
    return '';
  }

  const normalized = Math.min(
    (ratio - 1) / Math.max(maximumRatio - 1, 0.01),
    1,
  );
  const filled = Math.round(normalized * 10);

  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

const OPERATION_DISPLAY_NAMES: Record<string, string> = {
  set: 'Set',
  getBuffer: 'Get Buffer',
  'hash:HSET+HGET+HGETALL': 'Hash Round-Trip',
  'hash:HMSET+HMGET+HDEL': 'Hash Mutation',
  'set:SADD+SISMEMBER+SMEMBERS': 'Set Read',
  'set:SADD+SISMEMBER+SREM': 'Set Mutation',
  'expire:SET+EXPIRE+TTL': 'Expire',
  'nonTx:SETPX+GET': 'Non-Transaction',
  'list:LPUSH+RPUSH+LRANGE': 'List Range',
  'list:LPUSH+RPUSH+LPOP+RPOP+LLEN': 'List Mutation',
  'counter:INCR+DECR': 'Counter',
  'transaction:SET+EXPIRE+GET': 'Transaction',
  'transactionMixed:SET+GET': 'Transaction Mixed',
  'multiKey:MSET+MGET': 'Multi-Key',
  'pipeline:SET+INCR+GET': 'Pipeline Mixed',
  'stream:XADD+XRANGE+XLEN': 'Stream',
  'zset:ZADD+ZRANGE+ZREM': 'Sorted Set',
  'info:INFO+CONFIGGET': 'Info / Config',
  'pubsub:PUBLISH+MESSAGE': 'Pub/Sub',
};

function formatOperationName(raw: string): {
  display: string;
  commands: string;
} {
  const colonIndex = raw.indexOf(':');
  const display = OPERATION_DISPLAY_NAMES[raw] ?? raw;

  if (colonIndex === -1) {
    return { display, commands: raw.toUpperCase() };
  }

  const commands = raw.slice(colonIndex + 1);

  return {
    display,
    commands: commands.replace(/\+/g, ' + '),
  };
}

function formatDateTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function buildConfigurationTable(configuration: BenchConfig): string {
  const rows = [
    ['Mode', `\`${configuration.mode}\``],
    ['Payload Sizes', configuration.sizes.map(formatPayloadSize).join(', ')],
    ['Iterations', configuration.iterations.toLocaleString()],
    ['Warmup', configuration.warmup.toLocaleString()],
    ['Clients', `${configuration.clients}`],
    ['Concurrency / Client', `${configuration.concurrency}`],
    [
      'Total Concurrency',
      `${configuration.clients * configuration.concurrency}`,
    ],
    ['Repeats', `${configuration.repeats}`],
    ['Cooldown', `${configuration.cooldownMs}ms`],
    ['Platform', `${process.platform} ${process.arch}`],
    ['Node.js', process.version],
    ['Date', formatDateTime()],
  ];

  const lines: string[] = ['| Parameter | Value |', '|:----------|:------|'];

  for (const [key, value] of rows) {
    lines.push(`| ${key} | ${value} |`);
  }

  return lines.join('\n');
}

function buildSummaryStats(
  results: ComparedResult[],
  solidisLibrary: LibraryName,
): {
  maximumSpeedBoost: number;
  averageSpeedBoost: number;
  winsCount: number;
  totalComparable: number;
} {
  const solidisResults = results.filter(
    (result) =>
      result.library === solidisLibrary &&
      result.comparable &&
      result.ratioVsBaseline !== null,
  );

  let maximumSpeedBoost = 0;
  let totalSpeedBoost = 0;
  let winsCount = 0;

  for (const result of solidisResults) {
    if (result.ratioVsBaseline !== null) {
      const boost = result.ratioVsBaseline - 1;
      totalSpeedBoost += boost;

      if (boost > maximumSpeedBoost) {
        maximumSpeedBoost = boost;
      }

      if (result.ratioVsBaseline > 1) {
        winsCount += 1;
      }
    }
  }

  return {
    maximumSpeedBoost: maximumSpeedBoost * 100,
    averageSpeedBoost:
      solidisResults.length > 0
        ? (totalSpeedBoost / solidisResults.length) * 100
        : 0,
    winsCount,
    totalComparable: solidisResults.length,
  };
}

function findResultByLibrary(
  results: ComparedResult[],
  library: LibraryName,
): ComparedResult | undefined {
  return results.find((result) => result.library === library);
}

function formatElapsedMilliseconds(
  elapsedMilliseconds: number | null,
  bold: boolean,
): string {
  if (elapsedMilliseconds === null) {
    return '-';
  }

  const text = `${elapsedMilliseconds.toFixed(0)}ms`;

  return bold ? `**${text}**` : text;
}

interface TableBuildResult {
  table: string;
  lastRank: number;
}

function buildMainTable(
  groups: ResultGroup[],
  baselineLibrary: LibraryName,
  solidisLibrary: LibraryName,
  maximumRatio: number,
): TableBuildResult {
  const comparableGroups = groups.filter((group) => group.comparable);

  if (comparableGroups.length === 0) {
    return { table: '*No comparable results.*', lastRank: 0 };
  }

  const header = [
    `| | Benchmark | Commands | ${solidisLibrary} | ${baselineLibrary} | Difference | Performance |`,
    '|---:|:---|:---:|:---:|:---:|:---:|:---|',
  ];

  const rows: string[] = [];
  let rank = 0;

  for (const group of comparableGroups) {
    rank += 1;

    const solidisResult = findResultByLibrary(group.results, solidisLibrary);
    const baselineResult = findResultByLibrary(group.results, baselineLibrary);

    if (!solidisResult || !baselineResult) {
      continue;
    }

    const { display, commands } = formatOperationName(group.operation);

    const solidisElapsed = formatElapsedMilliseconds(
      solidisResult.elapsedMs,
      true,
    );
    const baselineElapsed = formatElapsedMilliseconds(
      baselineResult.elapsedMs,
      false,
    );

    const difference = formatPercentChange(solidisResult.ratioVsBaseline);
    const badge = getPerformanceBadge(solidisResult.ratioVsBaseline);
    const bar = makeProgressBar(solidisResult.ratioVsBaseline, maximumRatio);

    const differenceDisplay =
      solidisResult.ratioVsBaseline !== null &&
      solidisResult.ratioVsBaseline > 1
        ? `**${difference}**${badge}`
        : `${difference}${badge}`;

    rows.push(
      `| ${getRankMedal(rank)} | **${display}** | ` +
        `${commands} | ${solidisElapsed} | ${baselineElapsed} | ` +
        `${differenceDisplay} | \`${bar}\` |`,
    );
  }

  return { table: [...header, ...rows].join('\n'), lastRank: rank };
}

function buildNonComparableTable(
  groups: ResultGroup[],
  baselineLibrary: LibraryName,
  solidisLibrary: LibraryName,
  startRank: number,
  maximumRatio: number,
): string {
  const nonComparableGroups = groups.filter((group) => !group.comparable);

  if (nonComparableGroups.length === 0) {
    return '';
  }

  const header = [
    `| | Benchmark | Commands | ${solidisLibrary} | ${baselineLibrary} | Difference | Performance |`,
    '|---:|:---|:---:|:---:|:---:|:---:|:---|',
  ];

  const rows: string[] = [];
  let rank = startRank;

  for (const group of nonComparableGroups) {
    rank += 1;

    const solidisResult = findResultByLibrary(group.results, solidisLibrary);
    const baselineResult = findResultByLibrary(group.results, baselineLibrary);

    if (!solidisResult || !baselineResult) {
      continue;
    }

    const { display, commands } = formatOperationName(group.operation);

    const solidisElapsed = formatElapsedMilliseconds(
      solidisResult.elapsedMs,
      false,
    );
    const baselineElapsed = formatElapsedMilliseconds(
      baselineResult.elapsedMs,
      false,
    );

    const difference = formatPercentChange(solidisResult.ratioVsBaseline);
    const badge = getPerformanceBadge(solidisResult.ratioVsBaseline);
    const bar = makeProgressBar(solidisResult.ratioVsBaseline, maximumRatio);

    const differenceDisplay =
      solidisResult.ratioVsBaseline !== null &&
      solidisResult.ratioVsBaseline > 1
        ? `**${difference}**${badge}`
        : `${difference}${badge}`;

    rows.push(
      `| ${rank}. | **${display}** | ` +
        `${commands} | ${solidisElapsed} | ${baselineElapsed} | ` +
        `${differenceDisplay} | \`${bar}\` |`,
    );
  }

  return [...header, ...rows].join('\n');
}

function buildDetailedMetricsTable(
  groups: ResultGroup[],
  solidisLibrary: LibraryName,
): string {
  const comparableGroups = groups.filter((group) => group.comparable);

  if (comparableGroups.length === 0) {
    return '';
  }

  const header = [
    '| Benchmark | Library | ops/s | cmds/s | Elapsed | Spread |',
    '|:---|:---|---:|---:|---:|---:|',
  ];

  const rows: string[] = [];

  for (const group of comparableGroups) {
    const sortedResults = [...group.results].sort((left, right) => {
      if (left.library === solidisLibrary) {
        return -1;
      }
      if (right.library === solidisLibrary) {
        return 1;
      }
      return 0;
    });

    const { display, commands } = formatOperationName(group.operation);
    const label = commands ? `${display}: ${commands}` : display;
    let isFirstInGroup = true;

    for (const result of sortedResults) {
      const rowLabel = isFirstInGroup
        ? `**${label}**<br/><sub>${formatPayloadSize(group.payloadBytes)}</sub>`
        : '';

      const operationsText =
        result.unitsPerSecond !== null
          ? formatLargeNumber(result.unitsPerSecond)
          : '-';
      const commandsText =
        result.commandsPerSecond !== null
          ? formatLargeNumber(result.commandsPerSecond)
          : '-';
      const elapsedText =
        result.elapsedMs !== null ? `${result.elapsedMs.toFixed(0)}ms` : '-';
      const spreadText =
        result.spreadPercent !== null
          ? `±${result.spreadPercent.toFixed(1)}%`
          : '-';
      const libraryText =
        result.library === solidisLibrary
          ? `**${result.library}**`
          : result.library;

      rows.push(
        `| ${rowLabel} | ${libraryText} | ${operationsText} | ${commandsText} | ${elapsedText} | ${spreadText} |`,
      );

      isFirstInGroup = false;
    }
  }

  return [...header, ...rows].join('\n');
}

export function generateMarkdownReport(
  results: ComparedResult[],
  baselineLibrary: LibraryName,
  configuration: BenchConfig,
): string {
  const solidisLibrary = findSolidisLibrary(results);
  const sortedGroups = buildSortedResultGroups(results);
  const maximumRatio = Math.max(
    ...sortedGroups
      .filter((group) => group.comparable)
      .map((group) => group.maximumRatio),
    1,
  );

  const summary = buildSummaryStats(results, solidisLibrary);
  const totalConcurrency = configuration.clients * configuration.concurrency;
  const payloadLabel = configuration.sizes.map(formatPayloadSize).join(', ');
  const payloadSuffix = configuration.sizes.length > 1 ? 's' : '';
  const repeatSuffix = configuration.repeats > 1 ? 's' : '';

  const summaryItems = [
    `**${summary.winsCount}** / **${summary.totalComparable}** benchmarks won`,
    `**${Math.round(summary.averageSpeedBoost)}%** average speed improvement`,
    `**${Math.round(summary.maximumSpeedBoost)}%** peak speed improvement`,
  ];

  const mainTableResult = buildMainTable(
    sortedGroups,
    baselineLibrary,
    solidisLibrary,
    maximumRatio,
  );

  const nonComparableTable = buildNonComparableTable(
    sortedGroups,
    baselineLibrary,
    solidisLibrary,
    mainTableResult.lastRank,
    maximumRatio,
  );

  const lines: string[] = [
    '<div align="center">',
    '',
    `# ⚡ Solidis vs ${baselineLibrary} ⚡`,
    '',
    `<small>Generated on ${formatDateTime()} · ${process.platform} ${process.arch} · Node.js ${process.version}</small>`,
  ];

  if (summary.maximumSpeedBoost > 0) {
    lines.push(
      `### Up to **${Math.round(summary.maximumSpeedBoost)}% faster** than ${baselineLibrary}! 🚀`,
      '',
    );
  }

  lines.push(
    '---',
    '<br/>',
    '',
    `${summaryItems.join(' · ')}`,
    '',
    `*${configuration.iterations.toLocaleString()} iterations × ${totalConcurrency} concurrency · ${payloadLabel} payload${payloadSuffix} · ${configuration.repeats} repeat${repeatSuffix}*`,
    '',
    mainTableResult.table,
    '',
  );

  if (nonComparableTable) {
    lines.push(
      '### Non Strictly Comparable Benchmarks',
      '',
      '<sub>These benchmarks have library-specific behavior that prevents a strictly fair comparison.</sub>',
      '',
      nonComparableTable,
      '',
    );
  }

  lines.push(
    `<sub>Ranked by performance gain of \`${solidisLibrary}\` over \`${baselineLibrary}\` (baseline). Elapsed = median time across repeats.</sub>`,
    '',
    '</div>',
    '',
    '<br/>',
    '',
    '## 📊 Detailed Metrics',
    '',
    '<sub>All metrics per library: operations/s, commands/s, median elapsed time, and spread (coefficient of variation).</sub>',
    '',
    '<details>',
    '<summary>Click to expand detailed metrics table</summary>',
    '',
    buildDetailedMetricsTable(sortedGroups, solidisLibrary),
    '',
    '</details>',
    '',
    '---',
    '',
    '## ⚙️ Configuration',
    '',
    '<details>',
    '<summary>Click to expand benchmark configuration</summary>',
    '',
    buildConfigurationTable(configuration),
    '',
    '</details>',
    '',
    '---',
    '',
    '## 📖 Methodology',
    '',
    '- Each benchmark is run in an **isolated worker thread** to prevent GC and JIT cross-contamination',
    '- Libraries are **alternated** between repeats to reduce ordering bias',
    '- The Redis server is **flushed and settled** between each benchmark case',
    '- Payloads use a **deterministic pseudo-random pool** shared by both libraries',
    '- Elapsed time is the **median** across all repeat samples',
    '- Spread is the **coefficient of variation** (σ / median × 100%)',
    '',
  );

  return lines.join('\n');
}

function readExportPath(): string | undefined {
  return process.env.SOLIDIS_BENCH_EXPORT_MD?.trim() || undefined;
}

export function shouldExportMarkdown(): boolean {
  return readExportPath() !== undefined;
}

export async function exportMarkdownReport(
  results: ComparedResult[],
  baselineLibrary: LibraryName,
  configuration: BenchConfig,
): Promise<string | undefined> {
  const rawPath = readExportPath();

  if (!rawPath) {
    return undefined;
  }

  const outputPath = resolve(rawPath);
  const markdown = generateMarkdownReport(
    results,
    baselineLibrary,
    configuration,
  );

  await writeFile(outputPath, markdown, 'utf-8');

  return outputPath;
}

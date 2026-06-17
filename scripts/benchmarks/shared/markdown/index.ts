import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { formatLargeNumber, formatPayloadSize } from '../utils.ts';
import { en } from './locales/index.ts';

import type { BenchConfig, ComparedResult, LibraryName } from '../types.ts';
import type { BenchmarkLocale } from './locales/types.ts';

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

function formatRatio(ratio: number | null): string {
  if (ratio === null) {
    return '-';
  }

  if (ratio >= 1) {
    return `${ratio.toFixed(1)}x`;
  }

  return `${ratio.toFixed(1)}x`;
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

function formatOperationName(
  raw: string,
  displayNames: Record<string, string>,
): {
  display: string;
  commands: string;
} {
  const colonIndex = raw.indexOf(':');
  const display = displayNames[raw] ?? raw;

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

function buildConfigurationTable(
  configuration: BenchConfig,
  locale: BenchmarkLocale,
): string {
  const labels = locale.configLabels;

  const rows = [
    [labels.mode, `\`${configuration.mode}\``],
    [
      labels.payloadSizes,
      configuration.sizes.map(formatPayloadSize).join(', '),
    ],
    [labels.iterations, configuration.iterations.toLocaleString()],
    [labels.warmup, configuration.warmup.toLocaleString()],
    [labels.clients, `${configuration.clients}`],
    [labels.concurrencyPerClient, `${configuration.concurrency}`],
    [
      labels.totalConcurrency,
      `${configuration.clients * configuration.concurrency}`,
    ],
    [labels.repeats, `${configuration.repeats}`],
    [labels.cooldown, `${configuration.cooldownMs}ms`],
    [labels.platform, `${process.platform} ${process.arch}`],
    [labels.nodeJs, process.version],
    [labels.date, formatDateTime()],
  ];

  const lines: string[] = [
    `| ${labels.parameter} | ${labels.value} |`,
    '|:----------|:------|',
  ];

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
  locale: BenchmarkLocale,
): TableBuildResult {
  const comparableGroups = groups.filter((group) => group.comparable);

  if (comparableGroups.length === 0) {
    return { table: locale.noComparableResults, lastRank: 0 };
  }

  const h = locale.mainTableHeaders;

  const header = [
    `| | ${h.benchmark} | ${h.commands} | ${solidisLibrary} | ${baselineLibrary} | ${h.difference} | ${h.performance} |`,
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

    const { display, commands } = formatOperationName(
      group.operation,
      locale.operationDisplayNames,
    );

    const solidisElapsed = formatElapsedMilliseconds(
      solidisResult.elapsedMs,
      true,
    );
    const baselineElapsed = formatElapsedMilliseconds(
      baselineResult.elapsedMs,
      false,
    );

    const difference = formatRatio(solidisResult.ratioVsBaseline);
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
  locale: BenchmarkLocale,
): string {
  const nonComparableGroups = groups.filter((group) => !group.comparable);

  if (nonComparableGroups.length === 0) {
    return '';
  }

  const h = locale.mainTableHeaders;

  const header = [
    `| | ${h.benchmark} | ${h.commands} | ${solidisLibrary} | ${baselineLibrary} | ${h.difference} | ${h.performance} |`,
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

    const { display, commands } = formatOperationName(
      group.operation,
      locale.operationDisplayNames,
    );

    const solidisElapsed = formatElapsedMilliseconds(
      solidisResult.elapsedMs,
      false,
    );
    const baselineElapsed = formatElapsedMilliseconds(
      baselineResult.elapsedMs,
      false,
    );

    const difference = formatRatio(solidisResult.ratioVsBaseline);
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
  locale: BenchmarkLocale,
): string {
  const comparableGroups = groups.filter((group) => group.comparable);

  if (comparableGroups.length === 0) {
    return '';
  }

  const h = locale.detailedMetricsHeaders;

  const header = [
    `| ${h.benchmark} | ${h.library} | ${h.opsPerSec} | ${h.cmdsPerSec} | ${h.elapsed} | ${h.spread} |`,
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

    const { display, commands } = formatOperationName(
      group.operation,
      locale.operationDisplayNames,
    );
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
  locale: BenchmarkLocale = en,
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

  const summaryItems = [
    locale.benchmarksWon(summary.winsCount, summary.totalComparable),
    locale.averageSpeedImprovement(Math.round(summary.averageSpeedBoost)),
    locale.peakSpeedImprovement(Math.round(summary.maximumSpeedBoost)),
  ];

  const mainTableResult = buildMainTable(
    sortedGroups,
    baselineLibrary,
    solidisLibrary,
    maximumRatio,
    locale,
  );

  const nonComparableTable = buildNonComparableTable(
    sortedGroups,
    baselineLibrary,
    solidisLibrary,
    mainTableResult.lastRank,
    maximumRatio,
    locale,
  );

  const lines: string[] = [
    '<div align="center">',
    '',
    `# ${locale.reportTitle(baselineLibrary)}`,
    '',
    `<small>${locale.generatedOnPrefix} ${formatDateTime()} · ${process.platform} ${process.arch} · Node.js ${process.version}</small>`,
  ];

  if (summary.maximumSpeedBoost > 0) {
    const peakRatio = (summary.maximumSpeedBoost / 100 + 1).toFixed(1);

    lines.push(
      `### ${locale.upToFaster(`${peakRatio}x`, baselineLibrary)}`,
      '',
    );
  }

  lines.push(
    '---',
    '<br/>',
    '',
    `${summaryItems.join(' · ')}`,
    '',
    locale.subtitle(
      configuration.iterations,
      totalConcurrency,
      payloadLabel,
      configuration.sizes.length,
      configuration.repeats,
    ),
    '',
    mainTableResult.table,
    '',
  );

  if (nonComparableTable) {
    lines.push(
      locale.nonComparableTitle,
      '',
      `<sub>${locale.nonComparableDescription}</sub>`,
      '',
      nonComparableTable,
      '',
    );
  }

  lines.push(
    `<sub>${locale.rankingFootnote(solidisLibrary, baselineLibrary)}</sub>`,
    '',
    '</div>',
    '',
    '<br/>',
    '',
    locale.detailedMetricsTitle,
    '',
    `<sub>${locale.detailedMetricsDescription}</sub>`,
    '',
    '<details>',
    `<summary>${locale.expandDetailedMetrics}</summary>`,
    '',
    buildDetailedMetricsTable(sortedGroups, solidisLibrary, locale),
    '',
    '</details>',
    '',
    '---',
    '',
    locale.configurationTitle,
    '',
    '<details>',
    `<summary>${locale.expandConfiguration}</summary>`,
    '',
    buildConfigurationTable(configuration, locale),
    '',
    '</details>',
    '',
    '---',
    '',
    locale.methodologyTitle,
    '',
    ...locale.methodologyItems.map((item) => `- ${item}`),
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

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  formatLargeNumber,
  formatMemory,
  formatPayloadSize,
} from '../utils.ts';
import { analyze, findNoteNumber } from './analysis.ts';
import { fluentEmoji } from './emoji.ts';
import { en } from './locales/index.ts';

import type { BenchmarkSnapshot, BenchResult, LibraryInfo } from '../types.ts';
import type { BenchmarkAnalysis, CaseComparison } from './analysis.ts';
import type { BenchmarkLocale } from './locales/types.ts';

function formatRatio(ratio: number | null, digits: number): string {
  return ratio === null ? '-' : `${ratio.toFixed(digits)}x`;
}

function getLeadBadge(lead: number | null): string {
  const fire = fluentEmoji('Travel and places', 'Fire', 16);

  if (lead === null || lead <= 1.05) {
    return '';
  }

  if (lead >= 1.6) {
    return ` ${fire}${fire}`;
  }

  return lead >= 1.3
    ? ` ${fire}`
    : ` ${fluentEmoji('Travel and places', 'High Voltage', 16)}`;
}

function getRankMedal(rank: number): string {
  const medals = ['1st Place Medal', '2nd Place Medal', '3rd Place Medal'];

  return rank <= medals.length
    ? fluentEmoji('Activities', medals[rank - 1], 20)
    : `${rank}.`;
}

function formatOperation(operation: string, locale: BenchmarkLocale): string {
  const separator = operation.indexOf(':');
  const commands = (
    separator === -1 ? operation.toUpperCase() : operation.slice(separator + 1)
  )
    .split('+')
    .map((command) => `<kbd>${command}</kbd>`)
    .join(' ');

  return `**${locale.operationDisplayNames[operation] ?? operation}**<br/><sup>${commands}</sup>`;
}

function formatDate(isoDate: string): string {
  return isoDate.slice(0, 19).replace('T', ' ');
}

function formatNoteMarker(
  result: BenchResult,
  analysis: BenchmarkAnalysis,
): string {
  const number = findNoteNumber(analysis, result.nonComparableReason);

  return number === 0 ? '' : `<sup>${number}</sup>`;
}

function formatNativeMarker(library: LibraryInfo | undefined): string {
  return library?.hasNativeCore ? '<sup>†</sup>' : '';
}

function buildTitle(
  snapshot: BenchmarkSnapshot,
  analysis: BenchmarkAnalysis,
  locale: BenchmarkLocale,
): string {
  return `# ${locale.reportTitle(
    snapshot.libraries
      .map((library) => library.name)
      .filter((name) => name !== analysis.subjectLibrary),
  )}`;
}

function buildLeaderboard(
  analysis: BenchmarkAnalysis,
  locale: BenchmarkLocale,
): string {
  const headers = locale.leaderboardHeaders;
  const rows = analysis.standings.map((standing, index) => {
    const isSubject = standing.library.name === analysis.subjectLibrary;
    const emphasize = (text: string) => (isSubject ? `**${text}**` : text);

    return `| ${getRankMedal(index + 1)} | ${emphasize(standing.library.name)} | ${standing.library.version} | ${emphasize(`${standing.wins}`)} / ${analysis.cases.length} | ${emphasize(formatRatio(standing.relativeThroughput, 2))} | ${emphasize(formatRatio(standing.relativeCpu, 2))} | ${emphasize(formatRatio(standing.relativeMemory, 2))}${formatNativeMarker(standing.library)} |`;
  });

  return [
    `| | ${headers.client} | ${headers.version} | ${headers.fastestIn} | ${headers.throughput} | ${headers.cpu} | ${headers.memory} |`,
    '|---:|:---|:---|---:|---:|---:|---:|',
    ...rows,
  ].join('\n');
}

function buildStandings(
  analysis: BenchmarkAnalysis,
  locale: BenchmarkLocale,
): string[] {
  return [
    ...(analysis.averageLead === null
      ? []
      : [
          `### ${locale.headline(
            analysis.subjectWins,
            analysis.cases.length,
            formatRatio(analysis.averageLead, 1),
          )}`,
          '',
        ]),
    locale.leaderboardTitle,
    '',
    buildLeaderboard(analysis, locale),
    '',
    `<sub>${locale.leaderboardFootnote(analysis.subjectLibrary)}</sub>`,
    '',
    ...buildNativeFootnote(
      analysis.standings.map(({ library }) => library),
      locale,
    ),
  ];
}

function buildNativeFootnote(
  libraries: LibraryInfo[],
  locale: BenchmarkLocale,
): string[] {
  return libraries.some((library) => library.hasNativeCore)
    ? [`<sub><sup>†</sup> ${locale.nativeMemoryFootnote}</sub>`, '']
    : [];
}

function buildResultsTable(
  analysis: BenchmarkAnalysis,
  libraries: string[],
  locale: BenchmarkLocale,
): string {
  const headers = locale.mainTableHeaders;
  const formatCell = (comparison: CaseComparison, library: string) => {
    const result = comparison.results.find(
      (candidate) => candidate.library === library,
    );

    if (!result?.unitsPerSecond) {
      return '-';
    }

    const text = formatLargeNumber(result.unitsPerSecond);

    return `${result === comparison.fastest ? `**${text}**` : text}${formatNoteMarker(result, analysis)}`;
  };
  const rows = analysis.cases.map((comparison, index) => {
    const lead = formatRatio(comparison.lead, 1);

    return `| ${getRankMedal(index + 1)} | ${formatOperation(comparison.operation, locale)} | ${libraries.map((library) => formatCell(comparison, library)).join(' | ')} | ${comparison.lead !== null && comparison.lead > 1 ? `**${lead}**` : lead}${getLeadBadge(comparison.lead)} |`;
  });

  return [
    `| | ${headers.benchmark} | ${libraries.map((library) => (library === analysis.subjectLibrary ? `**${library}**` : library)).join(' | ')} | ${headers.lead} |`,
    `|---:|:---|${libraries.map(() => '---:').join('|')}|:---:|`,
    ...rows,
  ].join('\n');
}

function buildDetailedMetrics(
  analysis: BenchmarkAnalysis,
  libraries: LibraryInfo[],
  locale: BenchmarkLocale,
): string {
  const headers = locale.detailedMetricsHeaders;
  const latency = (milliseconds: number | undefined) =>
    milliseconds === undefined ? '-' : `${milliseconds.toFixed(2)}ms`;
  const rows = analysis.cases.flatMap((comparison) =>
    comparison.results.map((result, index) => {
      const label =
        index === 0
          ? `${formatOperation(comparison.operation, locale)}<br/><sub>${formatPayloadSize(comparison.payloadBytes)}</sub>`
          : '';
      const library = `${result.library === analysis.subjectLibrary ? `**${result.library}**` : result.library}${formatNoteMarker(result, analysis)}`;

      return `| ${label} | ${library} | ${formatLargeNumber(result.unitsPerSecond ?? 0)} | ${formatLargeNumber(result.commandsPerSecond ?? 0)} | ${latency(result.latencyPercentile50Milliseconds)} | ${latency(result.latencyPercentile95Milliseconds)} | ${latency(result.latencyPercentile99Milliseconds)} | ${latency(result.latencyPercentile999Milliseconds)} | ${result.cpuMicrosecondsPerUnit === undefined ? '-' : `${result.cpuMicrosecondsPerUnit.toFixed(2)}µs`} | ${result.gcMicrosecondsPerUnit === undefined ? '-' : `${result.gcMicrosecondsPerUnit.toFixed(2)}µs`} | ${result.peakMemoryBytes === undefined ? '-' : `${formatMemory(result.peakMemoryBytes)}${formatNativeMarker(libraries.find(({ name }) => name === result.library))}`} | ±${(result.spreadPercent ?? 0).toFixed(1)}% |`;
    }),
  );

  return [
    `| ${headers.benchmark} | ${headers.library} | ${headers.opsPerSec} | ${headers.cmdsPerSec} | ${headers.latencyPercentile50} | ${headers.latencyPercentile95} | ${headers.latencyPercentile99} | ${headers.latencyPercentile999} | ${headers.cpu} | ${headers.gc} | ${headers.memory} | ${headers.spread} |`,
    '|:---|:---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...rows,
  ].join('\n');
}

function buildEnvironment(
  snapshot: BenchmarkSnapshot,
  locale: BenchmarkLocale,
): string {
  const labels = locale.environmentLabels;
  const configuration = snapshot.configuration;
  const describe = (
    read: (environment: BenchmarkSnapshot['environments'][number]) => string,
  ) => [...new Set(snapshot.environments.map(read))].join('<br/>');
  const rows: [string, string][] = [
    [
      labels.cpu,
      describe(
        (environment) =>
          `${environment.cpuModel} (${environment.cpuCount} threads)`,
      ),
    ],
    [
      labels.memory,
      describe(
        (environment) =>
          `${(environment.totalMemoryBytes / 1024 ** 3).toFixed(1)} GB`,
      ),
    ],
    [
      labels.operatingSystem,
      describe(
        (environment) =>
          `${environment.platform} ${environment.arch} (${environment.osRelease})`,
      ),
    ],
    [labels.nodeJs, describe((environment) => environment.nodeVersion)],
    [labels.server, describe((environment) => environment.server)],
    [
      labels.clientVersions,
      snapshot.libraries
        .map((library) => `${library.name} ${library.version}`)
        .join(', '),
    ],
    [labels.mode, `\`${configuration.mode}\``],
    [
      labels.payloadSizes,
      configuration.sizes.map(formatPayloadSize).join(', '),
    ],
    [labels.iterations, configuration.iterations.toLocaleString('en-US')],
    [labels.warmup, configuration.warmup.toLocaleString('en-US')],
    [labels.connections, `${configuration.clients}`],
    [labels.concurrencyPerConnection, `${configuration.concurrency}`],
    [labels.repeats, `${configuration.repeats}`],
    [labels.cooldown, `${configuration.cooldownMs}ms`],
    [labels.date, formatDate(snapshot.createdAt)],
  ];

  return [
    `| ${labels.parameter} | ${labels.value} |`,
    '|:---|:---|',
    ...rows.map(([key, value]) => `| ${key} | ${value} |`),
  ].join('\n');
}

export function generateSummary(
  snapshot: BenchmarkSnapshot,
  locale: BenchmarkLocale = en,
): string {
  const analysis = analyze(snapshot);

  return [
    buildTitle(snapshot, analysis, locale),
    '',
    ...buildStandings(analysis, locale),
  ].join('\n');
}

export function generateMarkdownReport(
  snapshot: BenchmarkSnapshot,
  locale: BenchmarkLocale = en,
): string {
  const analysis = analyze(snapshot);
  const configuration = snapshot.configuration;
  const environment = snapshot.environments.at(-1);

  return [
    '<div align="center">',
    '',
    buildTitle(snapshot, analysis, locale),
    '',
    `<small>${[
      `${locale.generatedOnPrefix} ${formatDate(snapshot.createdAt)}`,
      ...(environment
        ? [
            `${environment.platform} ${environment.arch}`,
            `Node.js ${environment.nodeVersion}`,
            environment.server,
          ]
        : []),
    ].join(' · ')}</small>`,
    '',
    ...buildStandings(analysis, locale),
    locale.resultsTitle,
    '',
    locale.subtitle(
      configuration.iterations,
      configuration.clients * configuration.concurrency,
      configuration.sizes.map(formatPayloadSize).join(', '),
      configuration.sizes.length,
      configuration.repeats,
    ),
    '',
    analysis.cases.length > 0
      ? buildResultsTable(
          analysis,
          snapshot.libraries.map((library) => library.name),
          locale,
        )
      : locale.noResults,
    '',
    `<sub>${locale.rankingFootnote(analysis.subjectLibrary)}</sub>`,
    '',
    ...(analysis.notes.length > 0
      ? [
          analysis.notes
            .map(
              (note, index) =>
                `<sub><sup>${index + 1}</sup> ${locale.note(note)}</sub>`,
            )
            .join('<br/>\n'),
          '',
        ]
      : []),
    '</div>',
    '',
    locale.detailedMetricsTitle,
    '',
    `<sub>${locale.detailedMetricsDescription}</sub>`,
    '',
    '<details>',
    `<summary>${locale.expandDetailedMetrics}</summary>`,
    '',
    buildDetailedMetrics(analysis, snapshot.libraries, locale),
    '',
    ...buildNativeFootnote(snapshot.libraries, locale),
    '</details>',
    '',
    locale.environmentTitle,
    '',
    '<details>',
    `<summary>${locale.expandEnvironment}</summary>`,
    '',
    buildEnvironment(snapshot, locale),
    '',
    '</details>',
    '',
    locale.methodologyTitle,
    '',
    ...locale.methodologyItems.map((item) => `- ${item}`),
    '',
  ].join('\n');
}

function readExportPath(): string | undefined {
  return process.env.SOLIDIS_BENCH_EXPORT_MD?.trim() || undefined;
}

export function shouldExportMarkdown(): boolean {
  return readExportPath() !== undefined;
}

export async function exportMarkdownReport(
  snapshot: BenchmarkSnapshot,
): Promise<string> {
  const outputPath = resolve(readExportPath() ?? 'benchmark.md');

  await writeFile(outputPath, generateMarkdownReport(snapshot), 'utf-8');

  return outputPath;
}

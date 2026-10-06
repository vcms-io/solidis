import type { BenchmarkNote } from '../../types.ts';

export interface BenchmarkLocale {
  sectionTitle: string;

  reportTitle(competitors: string[]): string;
  generatedOnPrefix: string;
  headline(wins: number, total: number, averageLead: number): string;
  subtitle(
    iterations: number,
    concurrency: number,
    payloadLabel: string,
    payloadCount: number,
    repeats: number,
  ): string;

  leaderboardTitle: string;
  leaderboardHeaders: {
    client: string;
    version: string;
    fastestIn: string;
    throughput: string;
    cpu: string;
    memory: string;
  };
  leaderboardFootnote(subject: string): string;
  nativeMemoryFootnote: string;

  resultsTitle: string;
  mainTableHeaders: {
    benchmark: string;
    lead: string;
  };
  rankingFootnote(subject: string): string;
  note(note: BenchmarkNote): string;
  noResults: string;

  detailedMetricsTitle: string;
  detailedMetricsDescription: string;
  expandDetailedMetrics: string;
  detailedMetricsHeaders: {
    benchmark: string;
    library: string;
    opsPerSec: string;
    cmdsPerSec: string;
    latencyPercentile50: string;
    latencyPercentile95: string;
    latencyPercentile99: string;
    latencyPercentile999: string;
    cpu: string;
    gc: string;
    memory: string;
    spread: string;
  };

  environmentTitle: string;
  expandEnvironment: string;
  cpuThreads(count: number): string;
  environmentLabels: {
    parameter: string;
    value: string;
    cpu: string;
    memory: string;
    operatingSystem: string;
    nodeJs: string;
    server: string;
    clientVersions: string;
    mode: string;
    payloadSizes: string;
    iterations: string;
    warmup: string;
    connections: string;
    concurrencyPerConnection: string;
    repeats: string;
    cooldown: string;
    date: string;
  };

  methodologyTitle: string;
  methodologyItems: string[];

  operationDisplayNames: Record<string, string>;
}

export interface BenchmarkLocale {
  sectionTitle: string;

  reportTitle(baseline: string): string;
  generatedOnPrefix: string;
  upToFaster(percent: number, baseline: string): string;

  benchmarksWon(wins: number, total: number): string;
  averageSpeedImprovement(percent: number): string;
  peakSpeedImprovement(percent: number): string;
  subtitle(
    iterations: number,
    concurrency: number,
    payloadLabel: string,
    payloadCount: number,
    repeats: number,
  ): string;

  mainTableHeaders: {
    benchmark: string;
    commands: string;
    difference: string;
    performance: string;
  };

  noComparableResults: string;

  nonComparableTitle: string;
  nonComparableDescription: string;

  rankingFootnote(solidis: string, baseline: string): string;

  detailedMetricsTitle: string;
  detailedMetricsDescription: string;
  expandDetailedMetrics: string;

  detailedMetricsHeaders: {
    benchmark: string;
    library: string;
    opsPerSec: string;
    cmdsPerSec: string;
    elapsed: string;
    spread: string;
  };

  configurationTitle: string;
  expandConfiguration: string;

  configLabels: {
    parameter: string;
    value: string;
    mode: string;
    payloadSizes: string;
    iterations: string;
    warmup: string;
    clients: string;
    concurrencyPerClient: string;
    totalConcurrency: string;
    repeats: string;
    cooldown: string;
    platform: string;
    nodeJs: string;
    date: string;
  };

  methodologyTitle: string;
  methodologyItems: string[];

  operationDisplayNames: Record<string, string>;
}

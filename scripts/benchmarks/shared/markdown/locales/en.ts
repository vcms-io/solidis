import { fluentEmoji } from '../emoji.ts';

import type { BenchmarkLocale } from './types.ts';

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

export const en: BenchmarkLocale = {
  sectionTitle: `## ${fluentEmoji('Objects', 'Bar Chart')} Benchmarks`,

  reportTitle: (baseline) =>
    `${fluentEmoji('Travel and places', 'High Voltage')} Solidis vs ${baseline} ${fluentEmoji('Travel and places', 'High Voltage')}`,
  generatedOnPrefix: 'Generated on',
  upToFaster: (ratio, baseline) =>
    `Up to **${ratio} faster** than ${baseline}! ${fluentEmoji('Travel and places', 'Rocket')}`,

  benchmarksWon: (wins, total) => `**${wins}** / **${total}** benchmarks won`,
  averageSpeedImprovement: (percent) =>
    `**${percent}%** average speed improvement`,
  peakSpeedImprovement: (percent) => `**${percent}%** peak speed improvement`,
  subtitle: (iterations, concurrency, payloadLabel, payloadCount, repeats) =>
    `*${iterations.toLocaleString()} iterations × ${concurrency.toLocaleString()} concurrency · ${payloadLabel} ${plural(payloadCount, 'payload')} · ${repeats.toLocaleString()} ${plural(repeats, 'repeat')}*`,

  mainTableHeaders: {
    benchmark: 'Benchmark',
    commands: 'Commands',
    difference: 'Difference',
    performance: 'Performance',
  },

  noComparableResults: '*No comparable results.*',

  nonComparableTitle: '### Non Strictly Comparable Benchmarks',
  nonComparableDescription:
    'These benchmarks have library-specific behavior that prevents a strictly fair comparison.',

  rankingFootnote: (solidis, baseline) =>
    `Ranked by performance gain of \`${solidis}\` over \`${baseline}\` (baseline). Elapsed = median time across repeats.`,

  detailedMetricsTitle: `## ${fluentEmoji('Objects', 'Bar Chart')} Detailed Metrics`,
  detailedMetricsDescription:
    'All metrics per library: operations/s, commands/s, median elapsed time, and spread (coefficient of variation).',
  expandDetailedMetrics: 'Click to expand detailed metrics table',

  detailedMetricsHeaders: {
    benchmark: 'Benchmark',
    library: 'Library',
    opsPerSec: 'ops/s',
    cmdsPerSec: 'cmds/s',
    elapsed: 'Elapsed',
    spread: 'Spread',
  },

  configurationTitle: `## ${fluentEmoji('Objects', 'Gear')} Configuration`,
  expandConfiguration: 'Click to expand benchmark configuration',

  configLabels: {
    parameter: 'Parameter',
    value: 'Value',
    mode: 'Mode',
    payloadSizes: 'Payload Sizes',
    iterations: 'Iterations',
    warmup: 'Warmup',
    clients: 'Clients',
    concurrencyPerClient: 'Concurrency / Client',
    totalConcurrency: 'Total Concurrency',
    repeats: 'Repeats',
    cooldown: 'Cooldown',
    platform: 'Platform',
    nodeJs: 'Node.js',
    date: 'Date',
  },

  methodologyTitle: `## ${fluentEmoji('Objects', 'Open Book')} Methodology`,
  methodologyItems: [
    'Each benchmark is run in an **isolated worker thread** to prevent GC and JIT cross-contamination',
    'Libraries are **alternated** between repeats to reduce ordering bias',
    'The Redis server is **flushed and settled** between each benchmark case',
    'Payloads use a **deterministic pseudo-random pool** shared by both libraries',
    'Elapsed time is the **median** across all repeat samples',
    'Spread is the **coefficient of variation** (σ / median × 100%)',
  ],

  operationDisplayNames: {
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
  },
};

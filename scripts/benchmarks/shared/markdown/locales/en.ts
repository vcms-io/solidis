import { fluentEmoji } from '../emoji.ts';

import type { BenchmarkLocale } from './types.ts';

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function list(names: string[]): string {
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
    : names.join('');
}

export const en: BenchmarkLocale = {
  sectionTitle: `## ${fluentEmoji('Objects', 'Bar Chart')} Benchmarks`,

  reportTitle: (competitors) =>
    `${fluentEmoji('Travel and places', 'High Voltage')} Solidis vs ${list(competitors)}`,
  generatedOnPrefix: 'Generated on',
  headline: (wins, total, averageLead) =>
    `Fastest in **${wins}** of **${total}** benchmarks · **${averageLead}** the throughput of the next-fastest client on average ${fluentEmoji('Travel and places', 'Rocket')}`,
  subtitle: (iterations, concurrency, payloadLabel, payloadCount, repeats) =>
    `*${iterations.toLocaleString('en-US')} operations × ${concurrency.toLocaleString('en-US')} concurrency · ${payloadLabel} ${plural(payloadCount, 'payload')} · ${repeats.toLocaleString('en-US')} ${plural(repeats, 'repeat')} per client*`,

  leaderboardTitle: '### Leaderboard',
  leaderboardHeaders: {
    client: 'Client',
    version: 'Version',
    fastestIn: 'Fastest in',
    throughput: 'Throughput',
    cpu: 'CPU per operation',
    memory: 'Peak memory',
  },
  leaderboardFootnote: (subject) =>
    `Throughput, CPU per operation and peak memory are geometric means over all benchmarks, relative to \`${subject}\` (1.00x). Higher throughput and lower CPU and memory are better.`,
  nativeMemoryFootnote:
    'Memory the client keeps in native code is not counted.',

  resultsTitle: '### Operations per Second',
  mainTableHeaders: {
    benchmark: 'Benchmark',
    lead: 'Lead',
  },
  rankingFootnote: (subject) =>
    `Median operations per second over the repeats; the fastest client of each benchmark is in bold. Lead = \`${subject}\` ÷ the fastest other client.`,
  note: (note) =>
    note.kind === 'noAutoPipeline'
      ? `Does not auto-pipeline ${list(note.commands)}`
      : {
          resp3PubSub: 'Subscribes over RESP3, which it requires for Pub/Sub',
          atomicTransactions:
            'Does not take MULTI and EXEC in a batch, so it sends the commands between them as an atomic batch',
          batchedOperations:
            'Does not keep the order of concurrent commands, so it sends each operation as one batch',
        }[note.kind],
  noResults: '*No results.*',

  detailedMetricsTitle: `## ${fluentEmoji('Objects', 'Bar Chart')} Detailed Metrics`,
  detailedMetricsDescription:
    'Per library: operations and commands per second, latency (p50 / p95 / p99 / p99.9), CPU and GC time per operation, peak memory and spread.',
  expandDetailedMetrics: 'Click to expand the detailed metrics',
  detailedMetricsHeaders: {
    benchmark: 'Benchmark',
    library: 'Library',
    opsPerSec: 'ops/s',
    cmdsPerSec: 'cmds/s',
    latencyPercentile50: 'p50',
    latencyPercentile95: 'p95',
    latencyPercentile99: 'p99',
    latencyPercentile999: 'p99.9',
    cpu: 'CPU/op',
    gc: 'GC/op',
    memory: 'Memory',
    spread: 'Spread',
  },

  environmentTitle: `## ${fluentEmoji('Objects', 'Gear')} Environment and Configuration`,
  expandEnvironment: 'Click to expand the environment and configuration',
  environmentLabels: {
    parameter: 'Parameter',
    value: 'Value',
    cpu: 'CPU',
    memory: 'Memory',
    operatingSystem: 'Operating system',
    nodeJs: 'Node.js',
    server: 'Server',
    clientVersions: 'Clients',
    mode: 'Mode',
    payloadSizes: 'Payload sizes',
    iterations: 'Operations per sample',
    warmup: 'Warmup operations',
    connections: 'Connections per client',
    concurrencyPerConnection: 'Concurrency per connection',
    repeats: 'Repeats',
    cooldown: 'Cooldown',
    date: 'Date',
  },

  methodologyTitle: `## ${fluentEmoji('Objects', 'Open Book')} Methodology`,
  methodologyItems: [
    'Every sample runs in its own **worker thread**, so garbage collection and JIT state never carry over.',
    'The library order **rotates** per sample, and the server is **flushed and settled** before each one.',
    'All libraries get the same **deterministic binary payloads**, and every reply is checked after the measured phase.',
    'Throughput is the **median** of the repeats; spread is σ / median.',
    'Latency is timed **per operation** at the configured concurrency, over all repeats.',
    'CPU/op is the **process CPU time** (user + system) of the measured phase per operation, so it includes garbage collection and native threads. GC/op is the garbage-collection pause time, divided the same way.',
    "Memory is the largest growth of the worker's heap plus `ArrayBuffer` memory (all `Buffer`s) during the measured phase, sampled every 20 ms; memory held by native code is not counted. Replies are kept until checked, as an application would.",
    'Clients run with **timeouts, ready checks and reconnects off** and no pipelining limit. ioredis and iovalkey auto-pipeline; Valkey GLIDE and speedkey decode replies as bytes over RESP2.',
    'A result whose client could not run a benchmark the same way is **numbered** and explained below the table.',
    'Compared: every Node.js TCP client with 1,000+ weekly npm downloads that installs without compiling and keeps binary values. Left out: redis-fast-driver (native build), tedis (string values), HTTP clients such as @upstash/redis, and forks or wrappers. Valkey GLIDE has no Windows build.',
  ],

  operationDisplayNames: {
    set: 'Set',
    get: 'Get',
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

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

  headline: (peakSpeedup) =>
    `${fluentEmoji('Travel and places', 'High Voltage')} Up to ${peakSpeedup.toFixed(1)}x faster than other Node.js Redis clients ${fluentEmoji('Travel and places', 'Rocket')}`,
  standing: (wins, total, competitors) =>
    `Fastest in ${wins} of ${total} benchmarks against ${competitors} ${plural(competitors, 'client')}`,
  subtitle: (iterations, concurrency, payloadLabel, payloadCount, repeats) =>
    `${iterations.toLocaleString('en-US')} operations × ${concurrency.toLocaleString('en-US')} concurrency · ${payloadLabel} ${plural(payloadCount, 'payload')} · ${repeats.toLocaleString('en-US')} ${plural(repeats, 'repeat')}`,

  leaderboardTitle: '#### Leaderboard',
  leaderboardHeaders: {
    client: 'Client',
    version: 'Version',
    fastestIn: 'Fastest in',
    throughput: 'Throughput ↑',
    cpu: 'CPU / op ↓',
    memory: 'Peak memory ↓',
  },
  leaderboardFootnote: (subject) =>
    `Geometric means over all benchmarks, relative to \`${subject}\``,
  nativeMemoryFootnote: 'Native memory not counted',

  resultsTitle: '#### Operations per Second',
  mainTableHeaders: {
    benchmark: 'Benchmark',
    lead: 'Lead',
  },
  rankingFootnote: (subject) =>
    `Medians over the repeats · fastest in bold · Lead = \`${subject}\` ÷ the fastest other client`,
  notesTitle: 'Notes',
  note: (note) =>
    note.kind === 'noAutoPipeline'
      ? `Does not auto-pipeline ${list(note.commands)}`
      : {
          resp3PubSub: 'Needs RESP3 for Pub/Sub',
          atomicTransactions:
            'Sends MULTI/EXEC transactions as an atomic batch',
          batchedOperations:
            'Sends each operation as one batch to keep command order',
        }[note.kind],
  noResults: '*No results.*',

  detailedMetricsTitle: 'Detailed metrics',
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

  environmentTitle: 'Environment',
  cpuThreads: (count) => `${count} threads`,
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

  methodologyTitle: 'Methodology',
  methodologyItems: [
    'Every sample runs in its own **worker thread**, so garbage collection and JIT state never carry over.',
    'The library order **rotates** per sample, and the server is **flushed and settled** before each one.',
    'All libraries get the same **deterministic binary payloads**, and every reply and Pub/Sub message is checked after the measured phase.',
    'Transaction and Transaction Mixed send each operation as one batch (`batch` mode). Pub/Sub publishes at most 4 MB of messages at a time and waits until they arrive.',
    'Throughput is the **median** of the repeats; spread is σ / median.',
    'Latency is timed **per operation** at the configured concurrency, over all repeats.',
    'CPU/op is the **process CPU time** (user + system) of the measured phase per operation, so it includes garbage collection and native threads. GC/op is the garbage-collection pause time, divided the same way.',
    "Memory is the largest growth of the worker's heap plus `ArrayBuffer` memory (all `Buffer`s) during the measured phase, sampled every 20 ms; memory held by native code is not counted. Replies are kept until checked, as an application would.",
    'Clients run with **command timeouts, ready checks and reconnects off** and no pipelining limit. Valkey GLIDE and speedkey cannot turn reconnects off and wait up to 10 minutes per request. ioredis and iovalkey auto-pipeline; Valkey GLIDE and speedkey decode replies as bytes over RESP2.',
    'A result whose client could not run a benchmark the same way is **numbered** and explained below the table.',
    'Compared: every Node.js TCP client with 1,000+ weekly npm downloads that installs without compiling and keeps binary values. Left out: redis-fast-driver (native build), tedis (string values) and HTTP clients such as @upstash/redis. Valkey GLIDE has no Windows build.',
  ],

  operationDisplayNames: {
    set: 'Set',
    get: 'Get',
    'hash:HSET+HGET+HGETALL': 'Hash Round-Trip',
    'hash:HMSET+HMGET+HDEL': 'Hash Mutation',
    'set:SADD+SISMEMBER+SMEMBERS': 'Set Read',
    'set:SADD+SISMEMBER+SREM': 'Set Mutation',
    'expire:SET+EXPIRE+TTL': 'Expire',
    'nonTx:SET PX+GET': 'Non-Transaction',
    'list:LPUSH+RPUSH+LRANGE': 'List Range',
    'list:LPUSH+RPUSH+LPOP+RPOP+LLEN': 'List Mutation',
    'counter:INCR+DECR': 'Counter',
    'transaction:SET+EXPIRE+GET': 'Transaction',
    'transactionMixed:SET+GET': 'Transaction Mixed',
    'multiKey:MSET+MGET': 'Multi-Key',
    'pipeline:SET+INCR+GET': 'Pipeline Mixed',
    'stream:XADD+XRANGE+XLEN': 'Stream',
    'zset:ZADD+ZRANGE+ZREM': 'Sorted Set',
    'info:INFO+CONFIG GET': 'Info / Config',
    'pubsub:PUBLISH+MESSAGE': 'Pub/Sub',
  },
};

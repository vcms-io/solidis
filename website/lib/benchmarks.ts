export const benchmarkClients = [
  {
    name: 'solidis',
    version: '0.5.0',
  },
  {
    name: 'ioredis',
    version: '6.0.0',
  },
  {
    name: 'iovalkey',
    version: '0.4.0',
  },
  {
    name: 'node-redis',
    version: '6.3.0',
  },
  {
    name: 'valkey-glide',
    version: '2.5.3',
  },
  {
    name: 'speedkey',
    version: '0.4.2',
  },
];

export const benchmarkSummary = {
  wins: 19,
  total: 19,
  averageLead: 1.47,
  peakLead: 2.16,
  iterations: 100000,
  concurrency: 10000,
  repeats: 5,
  payload: '1 KB',
  mode: 'autopipeline',
  nodeVersion: 'v22.23.0',
  platform: 'linux x64',
  server: 'Redis 8.10.2',
  measuredOn: '2026-10-05',
};

export const benchmarkCases = [
  {
    name: {
      en: 'Transaction Mixed',
      ko: '트랜잭션 혼합',
    },
    commands: 'SET + GET',
    lead: 2.16,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 132489,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 28383,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 30515,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 61391,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 42067,
        note: 1,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 46702,
        note: 0,
      },
    ],
  },
  {
    name: {
      en: 'Transaction',
      ko: '트랜잭션',
    },
    commands: 'SET + EXPIRE + GET',
    lead: 2.13,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 166541,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 35400,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 39513,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 78160,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 66785,
        note: 1,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 55690,
        note: 0,
      },
    ],
  },
  {
    name: {
      en: 'Pub/Sub',
      ko: 'Pub/Sub',
    },
    commands: 'PUBLISH + MESSAGE',
    lead: 1.82,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 303068,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 145181,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 159889,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 166822,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 43026,
        note: 2,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 130874,
        note: 2,
      },
    ],
  },
  {
    name: {
      en: 'Set',
      ko: 'Set',
    },
    commands: 'SET',
    lead: 1.68,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 356016,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 145096,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 154884,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 212103,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 114190,
        note: 0,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 168189,
        note: 0,
      },
    ],
  },
  {
    name: {
      en: 'Set Read',
      ko: 'Set 조회',
    },
    commands: 'SADD + SISMEMBER + SMEMBERS',
    lead: 1.57,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 162910,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 60454,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 61533,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 104063,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 71317,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 84321,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'Sorted Set',
      ko: 'Sorted Set',
    },
    commands: 'ZADD + ZRANGE + ZREM',
    lead: 1.51,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 140288,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 57874,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 60743,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 93158,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 59909,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 69074,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'Set Mutation',
      ko: 'Set 변경',
    },
    commands: 'SADD + SISMEMBER + SREM',
    lead: 1.46,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 152865,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 55120,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 66221,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 104612,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 72579,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 96384,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'Hash Mutation',
      ko: 'Hash 변경',
    },
    commands: 'HMSET + HMGET + HDEL',
    lead: 1.46,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 130521,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 56190,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 60422,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 89452,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 52164,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 63384,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'Expire',
      ko: 'Expire',
    },
    commands: 'SET + EXPIRE + TTL',
    lead: 1.45,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 175382,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 74851,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 75247,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 120794,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 82053,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 93355,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'Counter',
      ko: 'Counter',
    },
    commands: 'INCR + DECR',
    lead: 1.41,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 262411,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 125352,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 127873,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 186646,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 102293,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 139762,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'Pipeline Mixed',
      ko: '파이프라인 혼합',
    },
    commands: 'SET + INCR + GET',
    lead: 1.41,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 159382,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 74311,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 74324,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 113366,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 74577,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 84374,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'Multi-Key',
      ko: 'Multi-Key',
    },
    commands: 'MSET + MGET',
    lead: 1.41,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 147734,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 62752,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 67363,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 105118,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 63253,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 74299,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'List Range',
      ko: 'List 범위',
    },
    commands: 'LPUSH + RPUSH + LRANGE',
    lead: 1.39,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 131181,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 54713,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 56837,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 94197,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 58771,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 73520,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'Non-Transaction',
      ko: '비트랜잭션',
    },
    commands: 'SET PX + GET',
    lead: 1.37,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 197536,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 83139,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 84659,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 144495,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 85057,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 104437,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'Hash Round-Trip',
      ko: 'Hash 왕복',
    },
    commands: 'HSET + HGET + HGETALL',
    lead: 1.34,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 147706,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 68192,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 71850,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 110564,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 60961,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 71031,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'Info / Config',
      ko: 'Info / Config',
    },
    commands: 'INFO + CONFIG GET',
    lead: 1.31,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 221248,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 110553,
        note: 4,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 115176,
        note: 4,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 169294,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 90634,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 96632,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'Stream',
      ko: 'Stream',
    },
    commands: 'XADD + XRANGE + XLEN',
    lead: 1.29,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 139482,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 59404,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 58520,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 107845,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 54787,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 54820,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'List Mutation',
      ko: 'List 변경',
    },
    commands: 'LPUSH + RPUSH + LPOP + RPOP + LLEN',
    lead: 1.2,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 109155,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 40558,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 42514,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 90870,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 49325,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 58306,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'Get',
      ko: 'Get',
    },
    commands: 'GET',
    lead: 1.05,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 349064,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 198949,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 194934,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 331877,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 112287,
        note: 0,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 183291,
        note: 0,
      },
    ],
  },
];

export const benchmarkNotes = [
  {
    en: 'Does not take MULTI and EXEC in a batch, so it sends the commands between them as an atomic batch',
    ko: '배치에 MULTI와 EXEC를 넣을 수 없어, 그 사이의 커맨드를 원자적 배치로 보냅니다',
  },
  {
    en: 'Subscribes over RESP3, which it requires for Pub/Sub',
    ko: 'Pub/Sub에는 RESP3가 필요해 RESP3로 구독합니다',
  },
  {
    en: 'Does not keep the order of concurrent commands, so it sends each operation as one batch',
    ko: '동시에 보낸 커맨드의 순서를 지키지 않아, 작업마다 배치 하나로 보냅니다',
  },
  {
    en: 'Does not auto-pipeline INFO',
    ko: 'INFO는 오토 파이프라이닝하지 않습니다',
  },
];

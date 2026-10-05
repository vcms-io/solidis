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
  averageLead: 1.49,
  peakLead: 2.22,
  iterations: 100000,
  concurrency: 10000,
  repeats: 10,
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
    lead: 2.22,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 134536,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 27368,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 29874,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 60703,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 41098,
        note: 1,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 45181,
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
    lead: 2.15,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 167552,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 34807,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 38165,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 77848,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 66183,
        note: 1,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 54732,
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
    lead: 1.9,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 296532,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 142876,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 156186,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 154723,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 43062,
        note: 2,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 129644,
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
    lead: 1.61,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 349248,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 144652,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 148163,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 216970,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 114260,
        note: 0,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 167742,
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
    lead: 1.55,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 159110,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 59471,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 59356,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 102882,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 69188,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 79240,
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
    lead: 1.49,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 164825,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 71032,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 72706,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 110472,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 70425,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 82632,
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
    lead: 1.49,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 172465,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 73053,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 73196,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 115728,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 79751,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 89051,
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
    lead: 1.47,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 142381,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 58851,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 62092,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 96750,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 59784,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 69558,
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
    lead: 1.47,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 149236,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 52896,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 54770,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 101633,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 68121,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 89585,
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
    lead: 1.45,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 148352,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 62435,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 68558,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 102319,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 62507,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 72212,
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
    lead: 1.42,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 265673,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 124158,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 129700,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 187633,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 105737,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 134108,
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
    lead: 1.42,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 195104,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 84579,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 85359,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 137798,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 83257,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 101586,
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
    lead: 1.41,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 125284,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 53553,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 57380,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 88555,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 51281,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 58763,
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
    lead: 1.4,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 128953,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 54641,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 56343,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 92335,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 57690,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 71900,
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
    lead: 1.39,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 144436,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 66371,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 68969,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 104026,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 61125,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 66880,
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
    lead: 1.32,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 140804,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 58847,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 59303,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 106636,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 53988,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 55483,
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
    lead: 1.27,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 224107,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 111848,
        note: 4,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 115316,
        note: 4,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 176162,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 90953,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 97013,
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
    lead: 1.22,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 107332,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 40141,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 40721,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 88155,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 48635,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 57041,
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
    lead: 1.08,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 350082,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 192022,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 189154,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 322770,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 112015,
        note: 0,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 177605,
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

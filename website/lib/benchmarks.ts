export const benchmarkClients = [
  {
    name: 'solidis',
  },
  {
    name: 'ioredis',
  },
  {
    name: 'iovalkey',
  },
  {
    name: 'node-redis',
  },
  {
    name: 'valkey-glide',
  },
  {
    name: 'speedkey',
  },
];

export const benchmarkSummary = {
  wins: 19,
  total: 19,
  averageLead: 1.4,
  peakLead: 2,
  iterations: 100000,
  concurrency: 10000,
  repeats: 10,
  payload: '1 KB',
  mode: 'autopipeline',
  nodeVersion: 'v22.23.3',
  platform: 'linux x64',
  server: 'Redis 8.10.2',
};

export const benchmarkCases = [
  {
    name: {
      en: 'Transaction',
      ko: '트랜잭션',
    },
    commands: 'SET + EXPIRE + GET',
    lead: 2,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 100713,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 23686,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 24675,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 51278,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 38756,
        note: 1,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 35898,
        note: 0,
      },
    ],
  },
  {
    name: {
      en: 'Transaction Mixed',
      ko: '트랜잭션 혼합',
    },
    commands: 'SET + GET',
    lead: 1.9,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 65860,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 12998,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 13786,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 35222,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 20551,
        note: 1,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 25197,
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
    lead: 1.8,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 157801,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 75818,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 83932,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 89949,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 24816,
        note: 2,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 68024,
        note: 2,
      },
    ],
  },
  {
    name: {
      en: 'Set Mutation',
      ko: 'Set 변경',
    },
    commands: 'SADD + SISMEMBER + SREM',
    lead: 1.5,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 99171,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 36644,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 37031,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 65674,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 43427,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 60817,
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
    lead: 1.5,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 78899,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 35944,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 35830,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 52823,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 34775,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 41601,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'Set',
      ko: 'Set',
    },
    commands: 'SET',
    lead: 1.5,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 152429,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 79426,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 79426,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 102276,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 60615,
        note: 0,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 81498,
        note: 0,
      },
    ],
  },
  {
    name: {
      en: 'Expire',
      ko: 'Expire',
    },
    commands: 'SET + EXPIRE + TTL',
    lead: 1.5,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 95327,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 45936,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 44853,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 65609,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 43564,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 55491,
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
    lead: 1.4,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 97462,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 43490,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 44557,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 70720,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 38462,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 49076,
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
    lead: 1.4,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 103451,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 46354,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 49820,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 75787,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 43374,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 62782,
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
    lead: 1.4,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 88414,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 36658,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 38709,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 65048,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 36438,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 47114,
        note: 3,
      },
    ],
  },
  {
    name: {
      en: 'Set Read',
      ko: 'Set 조회',
    },
    commands: 'SADD + SISMEMBER + SMEMBERS',
    lead: 1.3,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 73848,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 31119,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 31206,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 55393,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 32711,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 39308,
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
    lead: 1.3,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 83333,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 35715,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 38075,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 65284,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 33303,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 39949,
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
    lead: 1.3,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 92523,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 42105,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 44519,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 73640,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 37963,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 41908,
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
    lead: 1.3,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 69923,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 30186,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 32081,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 55765,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 30560,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 38847,
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
    lead: 1.2,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 63617,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 30733,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 30773,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 53936,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 25318,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 27288,
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
        operationsPerSecond: 60911,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 21631,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 22039,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 52042,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 25290,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 30756,
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
    lead: 1.1,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 184552,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 105461,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 106378,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 161236,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 67855,
        note: 0,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 89524,
        note: 0,
      },
    ],
  },
  {
    name: {
      en: 'Info / Config',
      ko: 'Info / Config',
    },
    commands: 'INFO + CONFIG GET',
    lead: 1,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 119155,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 54734,
        note: 4,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 56819,
        note: 4,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 116389,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 48210,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 51307,
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
    lead: 1,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 160176,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 81181,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 81108,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 158413,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 65491,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 81493,
        note: 3,
      },
    ],
  },
];

export const benchmarkNotes = [
  {
    en: 'Sends MULTI/EXEC transactions as an atomic batch',
    ko: 'MULTI/EXEC 트랜잭션을 원자적 배치로 전송',
  },
  {
    en: 'Needs RESP3 for Pub/Sub',
    ko: 'Pub/Sub에 RESP3 필요',
  },
  {
    en: 'Sends each operation as one batch to keep command order',
    ko: '커맨드 순서를 지키려고 작업마다 배치 하나로 전송',
  },
  {
    en: 'Does not auto-pipeline INFO',
    ko: 'INFO는 오토 파이프라이닝하지 않음',
  },
];

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
  averageLead: 1.51,
  peakLead: 2.86,
  iterations: 100000,
  concurrency: 10000,
  repeats: 5,
  payload: '1 KB',
  mode: 'autopipeline',
  nodeVersion: 'v22.23.0',
  platform: 'linux x64',
  server: 'Redis 8.10.2',
  measuredOn: '2026-10-04',
};

export const benchmarkCases = [
  {
    name: 'Pub/Sub',
    commands: 'PUBLISH + MESSAGE',
    lead: 2.86,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 417516,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 53133,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 56009,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 58068,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 43934,
        note: 1,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 145795,
        note: 1,
      },
    ],
  },
  {
    name: 'Transaction Mixed',
    commands: 'SET + GET',
    lead: 2.21,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 135743,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 27945,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 30405,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 61481,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 42248,
        note: 2,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 46978,
        note: 0,
      },
    ],
  },
  {
    name: 'Transaction',
    commands: 'SET + EXPIRE + GET',
    lead: 2.19,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 170151,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 35603,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 39148,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 77589,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 67294,
        note: 2,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 55889,
        note: 0,
      },
    ],
  },
  {
    name: 'Set',
    commands: 'SET',
    lead: 1.66,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 358588,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 144654,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 150988,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 216632,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 115715,
        note: 0,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 173263,
        note: 0,
      },
    ],
  },
  {
    name: 'Set Read',
    commands: 'SADD + SISMEMBER + SMEMBERS',
    lead: 1.51,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 158698,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 60044,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 60970,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 105357,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 69886,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 81814,
        note: 3,
      },
    ],
  },
  {
    name: 'Expire',
    commands: 'SET + EXPIRE + TTL',
    lead: 1.5,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 176662,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 74728,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 74042,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 117988,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 81648,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 93510,
        note: 3,
      },
    ],
  },
  {
    name: 'Pipeline Mixed',
    commands: 'SET + INCR + GET',
    lead: 1.47,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 161464,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 72169,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 72765,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 110060,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 73278,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 83964,
        note: 3,
      },
    ],
  },
  {
    name: 'Set Mutation',
    commands: 'SADD + SISMEMBER + SREM',
    lead: 1.45,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 150603,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 54562,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 55943,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 103954,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 68904,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 95150,
        note: 3,
      },
    ],
  },
  {
    name: 'Non-Transaction',
    commands: 'SETPX + GET',
    lead: 1.43,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 199141,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 84981,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 85394,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 139537,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 84803,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 105140,
        note: 3,
      },
    ],
  },
  {
    name: 'Sorted Set',
    commands: 'ZADD + ZRANGE + ZREM',
    lead: 1.41,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 135803,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 58457,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 58598,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 96649,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 60293,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 67905,
        note: 3,
      },
    ],
  },
  {
    name: 'Hash Mutation',
    commands: 'HMSET + HMGET + HDEL',
    lead: 1.4,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 129665,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 56380,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 57411,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 92620,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 50847,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 62275,
        note: 3,
      },
    ],
  },
  {
    name: 'Multi-Key',
    commands: 'MSET + MGET',
    lead: 1.4,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 146607,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 62691,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 67782,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 104888,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 62920,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 73153,
        note: 3,
      },
    ],
  },
  {
    name: 'List Range',
    commands: 'LPUSH + RPUSH + LRANGE',
    lead: 1.39,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 129149,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 54818,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 56357,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 93180,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 59012,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 73972,
        note: 3,
      },
    ],
  },
  {
    name: 'Counter',
    commands: 'INCR + DECR',
    lead: 1.36,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 256374,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 122279,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 126950,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 188379,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 105579,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 134550,
        note: 3,
      },
    ],
  },
  {
    name: 'Hash Round-Trip',
    commands: 'HSET + HGET + HGETALL',
    lead: 1.32,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 139889,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 67268,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 70715,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 106351,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 60126,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 68992,
        note: 3,
      },
    ],
  },
  {
    name: 'Info / Config',
    commands: 'INFO + CONFIGGET',
    lead: 1.3,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 221244,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 111662,
        note: 4,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 114254,
        note: 4,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 169603,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 89851,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 94652,
        note: 3,
      },
    ],
  },
  {
    name: 'Stream',
    commands: 'XADD + XRANGE + XLEN',
    lead: 1.3,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 138618,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 57671,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 59617,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 106839,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 53578,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 55703,
        note: 3,
      },
    ],
  },
  {
    name: 'List Mutation',
    commands: 'LPUSH + RPUSH + LPOP + RPOP + LLEN',
    lead: 1.2,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 108588,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 41561,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 41759,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 90323,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 49315,
        note: 3,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 57527,
        note: 3,
      },
    ],
  },
  {
    name: 'Get',
    commands: 'GET',
    lead: 1.11,
    clients: [
      {
        name: 'solidis',
        operationsPerSecond: 337734,
        note: 0,
      },
      {
        name: 'ioredis',
        operationsPerSecond: 194495,
        note: 0,
      },
      {
        name: 'iovalkey',
        operationsPerSecond: 193653,
        note: 0,
      },
      {
        name: 'node-redis',
        operationsPerSecond: 303690,
        note: 0,
      },
      {
        name: 'valkey-glide',
        operationsPerSecond: 113341,
        note: 0,
      },
      {
        name: 'speedkey',
        operationsPerSecond: 193311,
        note: 0,
      },
    ],
  },
];

export const benchmarkNotes = [
  {
    en: 'Subscribes over RESP3, which it requires for Pub/Sub',
    ko: 'Pub/Sub에는 RESP3가 필요해 RESP3로 구독합니다',
  },
  {
    en: 'Does not take MULTI and EXEC in a batch, so it sends the commands between them as an atomic batch',
    ko: '배치에 MULTI와 EXEC를 넣을 수 없어, 그 사이의 커맨드를 원자적 배치로 보냅니다',
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

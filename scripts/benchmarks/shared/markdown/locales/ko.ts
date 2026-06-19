import type { BenchmarkLocale } from './types.ts';

export const ko: BenchmarkLocale = {
  sectionTitle: '## 📊 벤치마크',

  reportTitle: (baseline) => `⚡ Solidis vs ${baseline} ⚡`,
  generatedOnPrefix: '측정일',
  upToFaster: (ratio, baseline) =>
    `${baseline} 대비 최대 **${ratio} 빠릅니다**! 🚀`,

  benchmarksWon: (wins, total) =>
    `**${total}**개 중 **${wins}**개 벤치마크 우위`,
  averageSpeedImprovement: (percent) => `평균 **${percent}%** 성능 향상`,
  peakSpeedImprovement: (percent) => `최대 **${percent}%** 성능 향상`,
  subtitle: (iterations, concurrency, payloadLabel, _payloadCount, repeats) =>
    `*${iterations.toLocaleString()}번 반복 × ${concurrency.toLocaleString()} 동시 실행 · ${payloadLabel} 페이로드 · ${repeats.toLocaleString()}회 측정*`,

  mainTableHeaders: {
    benchmark: '벤치마크',
    commands: '명령어',
    difference: '차이',
    performance: '성능',
  },

  noComparableResults: '*비교 가능한 결과가 없습니다.*',

  nonComparableTitle: '### 엄격 비교가 불가능한 벤치마크',
  nonComparableDescription:
    '라이브러리별 고유 동작으로 인해 엄밀한 비교가 어려운 벤치마크입니다.',

  rankingFootnote: (solidis, baseline) =>
    `\`${solidis}\`의 \`${baseline}\` (기준) 대비 성능 향상률 순으로 정렬. 소요 시간 = 반복 측정의 중앙값.`,

  detailedMetricsTitle: '## 📊 상세 지표',
  detailedMetricsDescription:
    '라이브러리별 전체 지표: 초당 작업 수, 초당 명령 수, 소요 시간 중앙값, 분산 (변동 계수).',
  expandDetailedMetrics: '상세 지표 테이블 펼치기',

  detailedMetricsHeaders: {
    benchmark: '벤치마크',
    library: '라이브러리',
    opsPerSec: 'ops/s',
    cmdsPerSec: 'cmds/s',
    elapsed: '소요 시간',
    spread: '분산',
  },

  configurationTitle: '## ⚙️ 설정',
  expandConfiguration: '벤치마크 설정 펼치기',

  configLabels: {
    parameter: '항목',
    value: '값',
    mode: '모드',
    payloadSizes: '페이로드 크기',
    iterations: '반복 횟수',
    warmup: '워밍업',
    clients: '클라이언트 수',
    concurrencyPerClient: '클라이언트당 동시 실행',
    totalConcurrency: '총 동시 실행',
    repeats: '측정 횟수',
    cooldown: '쿨다운',
    platform: '플랫폼',
    nodeJs: 'Node.js',
    date: '날짜',
  },

  methodologyTitle: '## 📖 측정 방법론',
  methodologyItems: [
    '각 벤치마크는 GC 및 JIT 간섭을 방지하기 위해 **격리된 워커 스레드**에서 실행됩니다',
    '순서 편향을 줄이기 위해 반복 측정 시 라이브러리를 **번갈아 실행**합니다',
    'Redis 서버는 각 벤치마크 케이스 사이에 **초기화 및 안정화**됩니다',
    '페이로드는 두 라이브러리가 공유하는 **결정론적 의사 난수 풀**을 사용합니다',
    '소요 시간은 전체 반복 샘플의 **중앙값**입니다',
    '분산은 **변동 계수** (σ / 중앙값 × 100%)입니다',
  ],

  operationDisplayNames: {
    set: 'Set',
    getBuffer: 'Get Buffer',
    'hash:HSET+HGET+HGETALL': 'Hash 왕복',
    'hash:HMSET+HMGET+HDEL': 'Hash 변경',
    'set:SADD+SISMEMBER+SMEMBERS': 'Set 조회',
    'set:SADD+SISMEMBER+SREM': 'Set 변경',
    'expire:SET+EXPIRE+TTL': 'Expire',
    'nonTx:SETPX+GET': '비트랜잭션',
    'list:LPUSH+RPUSH+LRANGE': 'List 범위',
    'list:LPUSH+RPUSH+LPOP+RPOP+LLEN': 'List 변경',
    'counter:INCR+DECR': 'Counter',
    'transaction:SET+EXPIRE+GET': '트랜잭션',
    'transactionMixed:SET+GET': '트랜잭션 혼합',
    'multiKey:MSET+MGET': 'Multi-Key',
    'pipeline:SET+INCR+GET': '파이프라인 혼합',
    'stream:XADD+XRANGE+XLEN': 'Stream',
    'zset:ZADD+ZRANGE+ZREM': 'Sorted Set',
    'info:INFO+CONFIGGET': 'Info / Config',
    'pubsub:PUBLISH+MESSAGE': 'Pub/Sub',
  },
};

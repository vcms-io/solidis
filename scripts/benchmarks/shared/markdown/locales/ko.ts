import { fluentEmoji } from '../emoji.ts';

import type { BenchmarkLocale } from './types.ts';

export const ko: BenchmarkLocale = {
  sectionTitle: `## ${fluentEmoji('Objects', 'Bar Chart')} 벤치마크`,

  reportTitle: (competitors) =>
    `${fluentEmoji('Travel and places', 'High Voltage')} Solidis vs ${competitors.join(', ')}`,
  generatedOnPrefix: '측정일',
  headline: (wins, total, averageLead) =>
    `벤치마크 **${total}**개 중 **${wins}**개에서 가장 빠름 · 다음으로 빠른 클라이언트보다 평균 **${averageLead}** 처리량 ${fluentEmoji('Travel and places', 'Rocket')}`,
  subtitle: (iterations, concurrency, payloadLabel, _payloadCount, repeats) =>
    `*작업 ${iterations.toLocaleString('en-US')}회 × 동시 실행 ${concurrency.toLocaleString('en-US')} · ${payloadLabel} 페이로드 · 클라이언트마다 ${repeats.toLocaleString('en-US')}회 측정*`,

  leaderboardTitle: '### 순위',
  leaderboardHeaders: {
    client: '클라이언트',
    version: '버전',
    fastestIn: '1위 횟수',
    throughput: '처리량',
    cpu: '작업당 CPU',
    memory: '최대 메모리',
  },
  leaderboardFootnote: (subject) =>
    `처리량, 작업당 CPU, 최대 메모리는 모든 벤치마크의 기하평균이며, \`${subject}\`(1.00x) 대비 값입니다. 처리량은 높을수록, CPU와 메모리는 낮을수록 좋습니다.`,
  nativeMemoryFootnote:
    '클라이언트가 네이티브 코드에서 쓰는 메모리는 포함하지 않습니다.',

  resultsTitle: '### 초당 작업 수',
  mainTableHeaders: {
    benchmark: '벤치마크',
    lead: '차이',
  },
  rankingFootnote: (subject) =>
    `반복 측정의 초당 작업 수 중앙값이며, 벤치마크마다 가장 빠른 클라이언트를 굵게 표시합니다. 차이 = \`${subject}\` ÷ 다른 클라이언트 중 가장 빠른 값.`,
  note: (note) =>
    note.kind === 'noAutoPipeline'
      ? `${note.commands.join(', ')}는 오토 파이프라이닝하지 않습니다`
      : {
          resp3PubSub: 'Pub/Sub에는 RESP3가 필요해 RESP3로 구독합니다',
          atomicTransactions:
            '배치에 MULTI와 EXEC를 넣을 수 없어, 그 사이의 커맨드를 원자적 배치로 보냅니다',
          batchedOperations:
            '동시에 보낸 커맨드의 순서를 지키지 않아, 작업마다 배치 하나로 보냅니다',
        }[note.kind],
  noResults: '*결과가 없습니다.*',

  detailedMetricsTitle: `## ${fluentEmoji('Objects', 'Bar Chart')} 상세 지표`,
  detailedMetricsDescription:
    '라이브러리별 초당 작업 수와 커맨드 수, 지연 시간(p50 / p95 / p99 / p99.9), 작업당 CPU와 GC 시간, 최대 메모리, 분산입니다.',
  expandDetailedMetrics: '상세 지표 펼치기',
  detailedMetricsHeaders: {
    benchmark: '벤치마크',
    library: '라이브러리',
    opsPerSec: 'ops/s',
    cmdsPerSec: 'cmds/s',
    latencyPercentile50: 'p50',
    latencyPercentile95: 'p95',
    latencyPercentile99: 'p99',
    latencyPercentile999: 'p99.9',
    cpu: 'CPU/작업',
    gc: 'GC/작업',
    memory: '메모리',
    spread: '분산',
  },

  environmentTitle: `## ${fluentEmoji('Objects', 'Gear')} 환경과 설정`,
  expandEnvironment: '환경과 설정 펼치기',
  environmentLabels: {
    parameter: '항목',
    value: '값',
    cpu: 'CPU',
    memory: '메모리',
    operatingSystem: '운영체제',
    nodeJs: 'Node.js',
    server: '서버',
    clientVersions: '클라이언트',
    mode: '모드',
    payloadSizes: '페이로드 크기',
    iterations: '샘플당 작업 수',
    warmup: '워밍업 작업 수',
    connections: '클라이언트당 연결 수',
    concurrencyPerConnection: '연결당 동시 실행',
    repeats: '측정 횟수',
    cooldown: '쿨다운',
    date: '날짜',
  },

  methodologyTitle: `## ${fluentEmoji('Objects', 'Open Book')} 측정 방법론`,
  methodologyItems: [
    '샘플마다 **별도 워커 스레드**에서 실행하므로 GC와 JIT 상태가 다음 라이브러리로 넘어가지 않습니다.',
    '샘플마다 라이브러리 순서를 **바꾸고**, 매번 서버를 **비우고 안정화**한 뒤 측정합니다.',
    '모든 라이브러리가 같은 **결정론적 바이너리 페이로드**를 쓰고, 측정이 끝나면 모든 응답을 검사합니다.',
    '처리량은 반복 측정의 **중앙값**이고, 분산은 σ / 중앙값입니다.',
    '지연 시간은 설정한 동시 실행 수에서 **작업마다** 재고, 모든 반복을 합쳐 계산합니다.',
    '작업당 CPU는 측정 구간의 **프로세스 CPU 시간**(user + system)을 작업 수로 나눈 값으로, GC와 네이티브 스레드를 포함합니다. 작업당 GC는 GC 일시정지 시간을 같은 방식으로 나눈 값입니다.',
    '메모리는 측정 구간 동안 워커의 힙과 `ArrayBuffer` 메모리(모든 `Buffer` 포함)가 가장 많이 늘어난 양이며, 20ms마다 잽니다. 네이티브 코드가 쓰는 메모리는 포함하지 않습니다. 실제 애플리케이션처럼 응답은 검사할 때까지 보관합니다.',
    '모든 클라이언트는 **타임아웃, 레디 체크, 재연결을 끄고** 파이프라이닝 제한 없이 실행합니다. ioredis와 iovalkey는 오토 파이프라이닝을 쓰고, Valkey GLIDE와 speedkey는 RESP2에서 응답을 바이트로 디코딩합니다.',
    '같은 방식으로 실행할 수 없었던 결과에는 **번호를 붙이고** 표 아래에 이유를 적습니다.',
    '비교 대상: npm 주간 다운로드가 1,000회 이상이고, 컴파일 없이 설치되며, 바이너리 값을 그대로 다루는 Node.js TCP 클라이언트 전부입니다. 제외: redis-fast-driver(네이티브 빌드 필요), tedis(값을 문자열로 반환), @upstash/redis 같은 HTTP 클라이언트, 포크와 래퍼. Valkey GLIDE는 Windows 빌드가 없습니다.',
  ],

  operationDisplayNames: {
    set: 'Set',
    get: 'Get',
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

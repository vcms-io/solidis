<p align="center" width="100%">
  <img src="https://resources.vcms.io/assets/solidis.png" alt="Solidis" width="300"/>
</p>

<h1 align="center">@vcms-io/solidis</h1>

<p align="center">
  <b>고성능, SOLID 구조의 Redis RESP 클라이언트</b>
</p>

<p align="center">
  <a href="#-개요">개요</a> •
  <a href="#-벤치마크">벤치마크</a> •
  <a href="#-주요-기능">주요 기능</a> •
  <a href="#-설치">설치</a> •
  <a href="#-사용법">사용법</a> •
  <a href="#%EF%B8%8F-설정">설정</a> •
  <a href="#-고급-기능">고급 기능</a><br/>
  <a href="#-확장">확장</a> •
  <a href="#%EF%B8%8F-에러-처리">에러 처리</a> •
  <a href="#-기여하기">기여하기</a> •
  <a href="#-라이선스">라이선스</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@vcms-io/solidis"><img src="https://img.shields.io/npm/v/@vcms-io/solidis.svg" alt="npm version"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/TypeScript-✓-blue" alt="TypeScript"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/ESM/CJS-✓-yellow" alt="ESM/CJS"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/RESP2/RESP3-✓-orange" alt="RESP2/RESP3"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/Zero_Dependencies-✓-green" alt="Zero Dependencies"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/Min_Bundle_Size-<30KB-brightgreen" alt="Bundle Size"></a>
</p>

> [English](./README.md) | **한국어**

## 🔍 개요

<p align="center" width="100%">
  <img src="https://resources.vcms.io/assets/bundle-graph.png" alt="번들 크기 비교" width="600"/>
</p>

Solidis는 SOLID 원칙, 제로 의존성, 엔터프라이즈급 성능을 고려하여 구축된 현대적인 RESP 클라이언트입니다. RESP2와 RESP3 프로토콜을 모두 지원하며, 최신 JavaScript/TypeScript 애플리케이션에 최적화되어 있습니다.

이 라이브러리는 최소한의 번들 크기와 최대한의 타입 안정성 및 성능을 위해 설계되었습니다:

- **순수 ESM/CJS** - 두 모듈 시스템 모두 지원
- **트리 쉐이킹 가능** - 필요한 것만 import
- **타입 안전성** - 모든 명령어에 대한 광범위한 TypeScript 정의
- **의존성 제로** - 런타임 의존성이 전혀 없음

<div id="benchmark">

## 📊 벤치마크

<div align="center">

# ⚡ Solidis vs ioredis ⚡

<small>측정일 2026-06-17 15:08:14 · linux x64 · Node.js v22.22.3</small>
### ioredis 대비 최대 **113% 빠릅니다**! 🚀

---
<br/>

**15**개 중 **15**개 벤치마크 우위 · 평균 **75%** 성능 향상 · 최대 **113%** 성능 향상

*100,000번 반복 × 10,000 동시 실행 · 1 KB 페이로드 · 10회 측정*

| | 벤치마크 | 명령어 | solidis | ioredis | 차이 | 성능 |
|---:|:---|:---:|:---:|:---:|:---:|:---|
| 🥇 | **Set 변경** | SADD + SISMEMBER + SREM | **1634ms** | 3483ms | **+113%** 🔥🔥 | `██████████` |
| 🥈 | **List 범위** | LPUSH + RPUSH + LRANGE | **1796ms** | 3688ms | **+105%** 🔥🔥 | `█████████░` |
| 🥉 | **List 변경** | LPUSH + RPUSH + LPOP + RPOP + LLEN | **2601ms** | 4961ms | **+91%** 🔥🔥 | `████████░░` |
| 4. | **Hash 변경** | HMSET + HMGET + HDEL | **1826ms** | 3447ms | **+89%** 🔥🔥 | `████████░░` |
| 5. | **Multi-Key** | MSET + MGET | **1719ms** | 3243ms | **+89%** 🔥🔥 | `████████░░` |
| 6. | **Sorted Set** | ZADD + ZRANGE + ZREM | **1813ms** | 3247ms | **+79%** 🔥🔥 | `███████░░░` |
| 7. | **Stream** | XADD + XRANGE + XLEN | **1849ms** | 3297ms | **+78%** 🔥🔥 | `███████░░░` |
| 8. | **Set** | SET | **776ms** | 1373ms | **+77%** 🔥🔥 | `███████░░░` |
| 9. | **Expire** | SET + EXPIRE + TTL | **1459ms** | 2539ms | **+74%** 🔥🔥 | `███████░░░` |
| 10. | **Set 조회** | SADD + SISMEMBER + SMEMBERS | **1480ms** | 2573ms | **+74%** 🔥🔥 | `███████░░░` |
| 11. | **파이프라인 혼합** | SET + INCR + GET | **1566ms** | 2503ms | **+60%** 🔥 | `█████░░░░░` |
| 12. | **비트랜잭션** | SETPX + GET | **1346ms** | 2065ms | **+53%** 🔥 | `█████░░░░░` |
| 13. | **Hash 왕복** | HSET + HGET + HGETALL | **1837ms** | 2795ms | **+52%** 🔥 | `█████░░░░░` |
| 14. | **Counter** | INCR + DECR | **904ms** | 1373ms | **+52%** 🔥 | `█████░░░░░` |
| 15. | **Get Buffer** | GETBUFFER | **616ms** | 895ms | **+45%** 🔥 | `████░░░░░░` |

### 엄격한 비교가 불가능한 벤치마크

<sub>라이브러리별 고유 동작으로 인해 엄밀한 비교가 어려운 벤치마크입니다.</sub>

| | 벤치마크 | 명령어 | solidis | ioredis | 차이 | 성능 |
|---:|:---|:---:|:---:|:---:|:---:|:---|
| 16. | **트랜잭션** | SET + EXPIRE + GET | 1307ms | 6187ms | **+373%** 🔥🔥 | `██████████` |
| 17. | **트랜잭션 혼합** | SET + GET | 1690ms | 7368ms | **+336%** 🔥🔥 | `██████████` |
| 18. | **Pub/Sub** | PUBLISH + MESSAGE | 797ms | 2698ms | **+238%** 🔥🔥 | `██████████` |
| 19. | **Info / Config** | INFO + CONFIGGET | 1062ms | 1983ms | **+87%** 🔥🔥 | `████████░░` |

<sub>`solidis`의 `ioredis` (기준) 대비 성능 향상률 순으로 정렬. 소요 시간 = 반복 측정의 중앙값.</sub>

</div>

<br/>

## 📊 상세 지표

<sub>라이브러리별 전체 지표: 초당 작업 수, 초당 명령 수, 소요 시간 중앙값, 분산 (변동 계수).</sub>

<details>
<summary>상세 지표 테이블 펼치기</summary>

| 벤치마크 | 라이브러리 | ops/s | cmds/s | 소요 시간 | 분산 |
|:---|:---|---:|---:|---:|---:|
| **Set 변경: SADD + SISMEMBER + SREM**<br/><sub>1 KB</sub> | **solidis** | 61.2K | 183.5K | 1634ms | ±6.5% |
|  | ioredis | 28.7K | 86.1K | 3483ms | ±2.0% |
| **List 범위: LPUSH + RPUSH + LRANGE**<br/><sub>1 KB</sub> | **solidis** | 55.7K | 167.0K | 1796ms | ±5.1% |
|  | ioredis | 27.1K | 81.3K | 3688ms | ±1.4% |
| **List 변경: LPUSH + RPUSH + LPOP + RPOP + LLEN**<br/><sub>1 KB</sub> | **solidis** | 38.4K | 192.2K | 2601ms | ±2.1% |
|  | ioredis | 20.2K | 100.8K | 4961ms | ±1.2% |
| **Hash 변경: HMSET + HMGET + HDEL**<br/><sub>1 KB</sub> | **solidis** | 54.8K | 164.3K | 1826ms | ±13.3% |
|  | ioredis | 29.0K | 87.0K | 3447ms | ±1.6% |
| **Multi-Key: MSET + MGET**<br/><sub>1 KB</sub> | **solidis** | 58.2K | 116.3K | 1719ms | ±2.8% |
|  | ioredis | 30.8K | 61.7K | 3243ms | ±3.5% |
| **Sorted Set: ZADD + ZRANGE + ZREM**<br/><sub>1 KB</sub> | **solidis** | 55.2K | 165.5K | 1813ms | ±5.2% |
|  | ioredis | 30.8K | 92.4K | 3247ms | ±0.9% |
| **Stream: XADD + XRANGE + XLEN**<br/><sub>1 KB</sub> | **solidis** | 54.1K | 162.2K | 1849ms | ±10.4% |
|  | ioredis | 30.3K | 91.0K | 3297ms | ±2.9% |
| **Set: SET**<br/><sub>1 KB</sub> | **solidis** | 128.8K | 128.8K | 776ms | ±3.4% |
|  | ioredis | 72.8K | 72.8K | 1373ms | ±1.4% |
| **Expire: SET + EXPIRE + TTL**<br/><sub>1 KB</sub> | **solidis** | 68.5K | 205.6K | 1459ms | ±10.1% |
|  | ioredis | 39.4K | 118.2K | 2539ms | ±1.5% |
| **Set 조회: SADD + SISMEMBER + SMEMBERS**<br/><sub>1 KB</sub> | **solidis** | 67.6K | 202.8K | 1480ms | ±3.1% |
|  | ioredis | 38.9K | 116.6K | 2573ms | ±2.8% |
| **파이프라인 혼합: SET + INCR + GET**<br/><sub>1 KB</sub> | **solidis** | 63.9K | 191.6K | 1566ms | ±3.6% |
|  | ioredis | 40.0K | 119.9K | 2503ms | ±0.7% |
| **비트랜잭션: SETPX + GET**<br/><sub>1 KB</sub> | **solidis** | 74.3K | 148.6K | 1346ms | ±6.0% |
|  | ioredis | 48.4K | 96.8K | 2065ms | ±2.2% |
| **Hash 왕복: HSET + HGET + HGETALL**<br/><sub>1 KB</sub> | **solidis** | 54.4K | 163.3K | 1837ms | ±6.3% |
|  | ioredis | 35.8K | 107.3K | 2795ms | ±1.7% |
| **Counter: INCR + DECR**<br/><sub>1 KB</sub> | **solidis** | 110.6K | 221.3K | 904ms | ±2.4% |
|  | ioredis | 72.8K | 145.7K | 1373ms | ±1.3% |
| **Get Buffer: GETBUFFER**<br/><sub>1 KB</sub> | **solidis** | 162.3K | 162.3K | 616ms | ±4.6% |
|  | ioredis | 111.7K | 111.7K | 895ms | ±2.0% |

</details>

---

## ⚙️ 설정

<details>
<summary>벤치마크 설정 펼치기</summary>

| 항목 | 값 |
|:----------|:------|
| 모드 | `autopipeline` |
| 페이로드 크기 | 1 KB |
| 반복 횟수 | 100,000 |
| 워밍업 | 1,000 |
| 클라이언트 수 | 1 |
| 클라이언트당 동시 실행 | 10000 |
| 총 동시 실행 | 10000 |
| 측정 횟수 | 10 |
| 쿨다운 | 2500ms |
| 플랫폼 | linux x64 |
| Node.js | v22.22.3 |
| 날짜 | 2026-06-17 15:08:14 |

</details>

---

## 📖 측정 방법론

- 각 벤치마크는 GC 및 JIT 간섭을 방지하기 위해 **격리된 워커 스레드**에서 실행됩니다
- 순서 편향을 줄이기 위해 반복 측정 시 라이브러리를 **번갈아 실행**합니다
- Redis 서버는 각 벤치마크 케이스 사이에 **초기화 및 안정화**됩니다
- 페이로드는 두 라이브러리가 공유하는 **결정론적 의사 난수 풀**을 사용합니다
- 소요 시간은 전체 반복 샘플의 **중앙값**입니다
- 분산은 **변동 계수** (σ / 중앙값 × 100%)입니다

</div>

## ✨ 주요 기능

- **경량**
  - 의존성 제로
  - 최소 번들 크기 < 30KB
  - 전체 번들 크기 (모든 명령어 포함) < 105KB

- **고성능**
  - 효율적인 파이프라인 및 배치 처리
  - 최소한의 메모리 사용량 (커스텀 최적화 파서)
  - 제로 카피 버퍼 작업
  - 지능형 버퍼 관리

- **프로토콜 지원**
  - RESP2 및 RESP3 프로토콜 지원
  - 자동 프로토콜 협상
  - 바이너리 안전 작업
  - 완전한 멀티바이트 문자 지원

- **고급 기능**
  - 트랜잭션 지원 (MULTI/EXEC)
  - 파이프라인 작업
  - Pub/Sub 기능
  - 자동 재연결
  - 명령어 타임아웃 처리

- **타입 안전성**
  - 강력한 TypeScript 지원
  - 포괄적인 타입 정의
  - 명령어별 타입 가드
  - 런타임 응답 타입 체킹

- **확장성**
  - 내부 및 외부 명령어로 클라이언트를 쉽게 확장
  - 커스터마이징 가능한 트랜잭션 처리
  - 플러그인 아키텍처 지원

## 📋 요구사항

- **런타임**: Node.js 14 이상
- **개발**: 최적의 안정성을 위해 Node.js 22 LTS 권장

## 📥 설치

```bash
# npm 사용
npm install @vcms-io/solidis

# yarn 사용
yarn add @vcms-io/solidis

# pnpm 사용
pnpm add @vcms-io/solidis
```

## 💻 사용법

### 📦 클라이언트 타입

Solidis는 두 가지 클라이언트 구현을 제공합니다:

#### 1. 기본 클라이언트 (SolidisClient)

기본 클라이언트는 번들 크기를 줄이기 위해 최소한의 기능만 포함합니다. 특정 명령어로 확장해야 합니다:

```typescript
import { SolidisClient } from '@vcms-io/solidis';
import { get } from '@vcms-io/solidis/command/get';
import { set } from '@vcms-io/solidis/command/set';
import { multi } from '@vcms-io/solidis/command/multi';

import type { SolidisClientExtensions } from '@vcms-io/solidis';

// 타입 안전성을 가진 확장 정의
const extensions = {
  get,
  set,
  multi
} satisfies SolidisClientExtensions;

// 확장으로 클라이언트 초기화
const client = new SolidisClient({
  host: '127.0.0.1',
  port: 6379
}).extend(extensions);

// 명령어 사용
await client.set('key', 'value');

const value = await client.get('key');
```

#### 2. 기능 완전 클라이언트 (SolidisFeaturedClient)

모든 RESP 명령어가 미리 로드된 편리한 클라이언트:

```typescript
import { SolidisFeaturedClient } from '@vcms-io/solidis/featured';

// 모든 RESP 명령어가 미리 로드됨
const client = new SolidisFeaturedClient({
  host: '127.0.0.1',
  port: 6379
});

// 모든 RESP 명령어를 직접 사용
await client.set('key', 'value');
await client.hset('hash', 'field', 'value');
await client.lpush('list', 'item-1', 'item-2');
```

### 🔌 연결 관리

```typescript
// 클라이언트 생성 (lazy connect 사용)
const client = new SolidisClient({
  uri: 'redis://127.0.0.1:6379',
  lazyConnect: true
}).extend({ get, set });

// 필요할 때 명시적으로 연결
await client.connect();

// 연결 이벤트 처리
client.on('connect', () => console.log('서버에 연결됨'));
client.on('ready', () => console.log('클라이언트가 명령어를 받을 준비가 됨'));
client.on('error', (err) => console.error('에러 발생:', err));
client.on('end', () => console.log('연결 종료됨'));

// 완료되면 연결 종료
client.quit();
```

### ⚙️ 기본 작업

```typescript
// 키 설정
await client.set('key', 'value');

// 키 가져오기
const value = await client.get('key');

console.log(value); // 'value'

// 키 삭제
await client.del('key');
```

### 💱 트랜잭션

```typescript
// 트랜잭션 시작
const transaction = client.multi();

// 명령어 큐에 추가 (await 필요 없음)
transaction.set('key', 'value');
transaction.incr('counter');
transaction.get('key');

// 트랜잭션 실행
const results = await transaction.exec();

console.log(results); // [[ 'OK' ], [ 1 ], [ <Buffer 76 61 6c 75 65> ]]

// 필요한 경우 트랜잭션 취소
const transaction = client.multi();

transaction.set('key', 'value');
transaction.discard(); // 트랜잭션 취소
```

### ⏩ 파이프라인

```typescript
// 파이프라인용 명령어 생성
const commands = [
  ['set', 'pipeline', 'value'],
  ['incr', 'counter'],
  ['get', 'pipeline']
];

// 파이프라인으로 명령어 전송
const results = await client.send(commands);

console.log(results); // [[ 'OK' ], [ 1 ], [ <Buffer 76 61 6c 75 65> ]]
```

### 📡 Pub/Sub

```typescript
// 채널 구독
client.on('message', (channel, message) => {
  console.log(`${channel}에서 ${message} 수신`);
});

await client.subscribe('news');

// 다른 클라이언트에서 발행
await client.publish('news', 'Hello world!');
```

## ⚙️ 설정

Solidis는 광범위한 설정 옵션을 제공합니다:

```typescript
const client = new SolidisClient({
  // 연결
  uri: 'redis://localhost:6379',
  host: '127.0.0.1',
  port: 6379,
  useTLS: false,
  lazyConnect: false,

  // 인증
  authentication: {
    username: 'user',
    password: 'password'
  },
  database: 0,

  // 프로토콜 및 복구
  clientName: 'solidis',
  protocol: 'RESP2',                    // 'RESP2' 또는 'RESP3'
  autoReconnect: true,
  enableReadyCheck: true,
  maxConnectionRetries: 20,
  connectionRetryDelay: 100,
  autoRecovery: {
    database: true,                     // 재연결 후 DB 자동 선택
    subscribe: true,                    // 채널 자동 재구독
    ssubscribe: true,                   // 샤드 채널 자동 재구독
    psubscribe: true,                   // 패턴 자동 재구독
  },

  // 타임아웃 (밀리초)
  commandTimeout: 5000,
  connectionTimeout: 2000,
  socketWriteTimeout: 1000,
  readyCheckInterval: 100,

  // 성능 튜닝
  maxCommandsPerPipeline: 300,
  maxProcessRepliesPerChunk: 4 * 1024,  // 4KB
  maxSocketWriteSizePerOnce: 64 * 1024, // 64KB
  rejectOnPartialPipelineError: false,

  // 파서 설정
  parser: {
    buffer: {
      initial: 4 * 1024 * 1024,         // 4MB
      shiftThreshold: 2 * 1024 * 1024,  // 2MB
    },
  },

  // 이벤트 리스너
  maxEventListenersForClient: 10 * 1024,
  maxEventListenersForSocket: 10 * 1024,

  // 디버그 옵션
  debug: false,
  debugMaxEntries: 10 * 1024,
});
```

## 🚀 고급 기능

### 🛠️ 커스텀 명령어

```typescript
import { SolidisClient } from '@vcms-io/solidis';
import { get, set } from '@vcms-io/solidis/command';

import type { SolidisClientExtensions } from '@vcms-io/solidis';

// 커스텀 명령어로 확장 정의
const extensions = {
  get,
  set,
  // 커스텀 명령어 구현
  fill: async function(this: typeof client, keys: string[], value: string) {
    return await Promise.all(keys.map((key) => this.set(key, value)));
  },
} satisfies SolidisClientExtensions;

const client = new SolidisClient({
  host: '127.0.0.1',
  port: 6379
}).extend(extensions);

// 커스텀 명령어 사용
await client.fill(['key1', 'key2', 'key3'], 'value');
```

### ⚡ Raw 명령어

아직 구현되지 않은 명령어를 사용해야 할 때:

```typescript
// send()로 raw 명령어 사용
const result = await client.send([['command', 'some', 'options']]);
```

### 🐛 디버깅

상세한 디버그 로깅 활성화:

```typescript
// 디버그 모드 활성화
const client = new SolidisClient({
  debug: true
});

// 디버그 이벤트 리스닝
client.on('debug', (entry) => {
  console.log(`[${entry.type}] ${entry.message}`, entry.data);
});

// 대안: 환경 변수
// DEBUG=solidis node app.js
```

## 🧩 확장

`@vcms-io/solidis-extensions` 패키지는 Solidis 클라이언트를 위한 추가 기능과 유틸리티를 제공합니다. Redis 작업을 향상시키기 위한 사전 구축된 확장을 포함합니다.

### 📥 설치

```bash
# npm 사용
npm install @vcms-io/solidis-extensions

# yarn 사용
yarn add @vcms-io/solidis-extensions

# pnpm 사용
pnpm add @vcms-io/solidis-extensions
```

### 📚 사용 가능한 확장

- [**SpinLock**](https://github.com/vcms-io/solidis-extensions/blob/main/sources/domains/spinlock/README.md) - Solidis 명령어 확장으로 구현된 경량 뮤텍스
- [**RedLock**](https://github.com/vcms-io/solidis-extensions/blob/main/sources/domains/redlock/README.md) - Redlock 알고리즘 기반 내결함성 분산 뮤텍스

자세한 사용 예제는 [확장 문서](https://github.com/vcms-io/solidis-extensions)를 확인하세요.

## ⚠️ 에러 처리

Solidis는 다양한 실패 모드에 대해 상세한 에러 클래스를 제공합니다:

```typescript
import {
  SolidisClientError,
  SolidisConnectionError,
  SolidisParserError,
  SolidisPubSubError,
  SolidisRequesterError,
  unwrapSolidisError,
} from '@vcms-io/solidis';

try {
  await client.set('key', 'value');
} catch (error) {
  // 스택 트레이스와 함께 근본 원인 가져오기
  console.error(unwrapSolidisError(error));

  // 특정 에러 타입 처리
  if (error instanceof SolidisConnectionError) {
    console.error('연결 에러:', error.message);
  } else if (error instanceof SolidisParserError) {
    console.error('파서 에러:', error.message);
  } else if (error instanceof SolidisClientError) {
    console.error('클라이언트 에러:', error.message);
  }
}
```

## 🏗️ 구조

```
┌─────────────────────────────────────────────────┐
│                  SolidisClient                  │
│                                                 │
│        모든 컴포넌트를 생성하고 조정합니다         │
│                                                 │
│     ┌────────────────────────────────────┐      │
│     │             Debug Memory           │      │
│     └───────┬───────────────────┬────────┘      │
│             ▼                   ▼               │
│     ┌────────────────┐  ┌────────────────┐      │
│     │   Connection   │─►│   Requester    │─┐    │
│     └────────────────┘  └────────────────┘ │    │
│                         ┌────────────────┐ │    │
│                         │     Parser     │◄┤    │
│                         └────────────────┘ │    │
│                         ┌────────────────┐ │    │
│                         │     PubSub     │◄┘    │
│                         └────────────────┘      │
│                                                 │
└─────────────────────────────────────────────────┘
         ┌──────────────┴─────────────┐
         ▼                            ▼
┌─────────────────┐       ┌───────────────────────┐
│ SolidisClient   │       │ SolidisFeaturedClient │
│ (확장 필요)     │       │ (모든 명령어 포함)     │
└─────────────────┘       └───────────────────────┘
```

Solidis 구조는 명확한 컴포넌트 분리를 따릅니다:

- **SolidisClient**: 모든 컴포넌트를 생성하고 조정하는 핵심 진입점
- **Debug Memory**: 클라이언트에서 생성되어 다른 컴포넌트에 주입됨
- **Connection**: TCP/TLS 소켓 연결, 재연결 및 복구 관리
- **Requester**: 명령어 파이프라이닝 및 요청 상태 처리
- **Parser**: 최적화된 버퍼 처리로 RESP2/RESP3 프로토콜 처리
- **PubSub**: 구독 상태를 유지하며 Requester가 pub/sub 이벤트에 사용

## 🔔 이벤트 시스템

Solidis는 다음 이벤트를 발생시킵니다:

```typescript
// 연결 이벤트
client.on('connect', () => console.log('서버에 연결됨'));
client.on('ready', () => console.log('클라이언트 준비됨'));
client.on('end', () => console.log('연결 종료됨'));
client.on('error', (err) => console.error('에러:', err));

// Pub/Sub 이벤트
client.on('message', (channel, message) => console.log(`${channel}: ${message}`));
client.on('pmessage', (pattern, channel, message) => console.log(`${pattern} ${channel}: ${message}`));
client.on('subscribe', (channel, count) => console.log(`${channel}에 구독함`));
client.on('unsubscribe', (channel, count) => console.log(`${channel}에서 구독 해제함`));

// 디버그 이벤트
client.on('debug', (entry) => console.log(`[${entry.type}] ${entry.message}`));
```

## 🤝 기여하기

Solidis는 오픈소스 프로젝트이며 커뮤니티의 기여를 환영합니다. 기여 방법은 다음과 같습니다:

### 💻 개발 환경 설정

```bash
# 저장소 복제
git clone https://github.com/vcms-io/solidis.git
cd solidis

# 의존성 설치
npm install

# 프로젝트 빌드
npm run build

# 테스트 실행
npm test
```

### 📜 기여 가이드라인

1. **저장소 포크**: 먼저 저장소를 포크하고 포크한 저장소를 복제합니다.

2. **브랜치 생성**: 기능이나 버그 수정을 위한 브랜치를 생성합니다:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **코드 스타일 준수**:
   - TypeScript strict 모드 사용
   - 기존 패턴과 명명 규칙 따르기

4. **Pull Request 제출**: 변경 사항을 포크에 푸시하고 pull request를 제출합니다.
   - 변경 사항에 대한 명확한 설명 제공
   - 관련 이슈 참조
   - 적절한 문서 추가

### ✅ 코드 품질 가이드라인

- **TypeScript**: 엄격한 타이핑 사용 및 가능한 한 `any` 타입과 `as` 캐스트 피하기
- **의존성**: 절대적으로 필요한 경우가 아니면 새 의존성 추가 피하기
- **성능**: 변경 사항의 성능 영향 고려
- **번들 크기**: 번들 크기를 최소로 유지

### 🚀 릴리스 프로세스

Solidis는 시맨틱 버저닝(SemVer)을 따릅니다:
- **패치 (0.0.x)**: API에 영향을 주지 않는 버그 수정 및 사소한 변경
- **마이너 (0.x.0)**: 하위 호환성을 유지하며 추가된 새 기능
- **메이저 (x.0.0)**: 공개 API에 대한 호환성을 깨는 변경

## 📄 라이선스

MIT 라이선스. 자세한 내용은 [LICENSE](/LICENSE)를 참조하세요.

<h1 align="center"><img src="./assets/solidis.png" alt="Solidis" width="50"/></h1>

<h3 align="center">
  <b>Node.js에서 가장 빠른 Redis 클라이언트.<br/>의존성 없음, 프로덕션에서 검증된 안정성.</b>
</h3>

<br/>

<p align="center">
  <a href="https://www.npmjs.com/package/@vcms-io/solidis"><img src="https://img.shields.io/npm/v/@vcms-io/solidis.svg?style=flat-square&labelColor=000&color=f5a623" alt="npm"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/coverage-100%25-brightgreen?style=flat-square&labelColor=000" alt="coverage"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square&labelColor=000" alt="deps"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/min_bundle-<30KB-blue?style=flat-square&labelColor=000" alt="bundle"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/RESP2%2FRESP3-supported-orange?style=flat-square&labelColor=000" alt="RESP"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/ESM%2FCJS-dual-yellow?style=flat-square&labelColor=000" alt="modules"></a>
</p>

<p align="center">
  <a href="#빠른-시작">빠른 시작</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#기능">기능</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#설정">설정</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#아키텍처">아키텍처</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#확장">확장</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="./README.md">English</a>
</p>

<br/>

<p align="center">
  <img src="./assets/bundle.png" alt="번들 크기 비교" width="640"/>
</p>

<table align="center">
<tr>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Rocket.png?raw=true" alt="Rocket" width="32" height="32" /><br/><strong>0 deps</strong><br/><sub>의존성 없음</sub></td>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Package.png?raw=true" alt="Package" width="32" height="32" /><br/><strong>384</strong><br/><sub>커맨드</sub></td>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Test%20Tube.png?raw=true" alt="Test Tube" width="32" height="32" /><br/><strong>35K+</strong><br/><sub>테스트 코드 줄 수</sub></td>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Animals/Feather.png?raw=true" alt="Feather" width="32" height="32" /><br/><strong>&lt; 30KB</strong><br/><sub>최소 번들</sub></td>
</tr>
</table>

<br/>

## 빠른 시작

```bash
npm install @vcms-io/solidis
```

```typescript
import { SolidisFeaturedClient } from '@vcms-io/solidis/featured';

const client = new SolidisFeaturedClient({ host: '127.0.0.1', port: 6379 });

await client.set('key', 'value');
const value = await client.get('key');
```

> [!TIP]
> **번들을 더 줄이려면** `SolidisClient`와 `.extend()`로 쓰는 커맨드만 가져오세요. 트리 셰이킹하면 **30KB 미만**입니다.

<details>
<summary>&nbsp;&nbsp;<b>트리 셰이킹 클라이언트</b></summary>

<br/>

```typescript
import { SolidisClient } from '@vcms-io/solidis';
import { get } from '@vcms-io/solidis/command/get';
import { set } from '@vcms-io/solidis/command/set';

const client = new SolidisClient({ host: '127.0.0.1', port: 6379 }).extend({ get, set });
```

`extend()`는 객체의 함수를 클래스 메서드까지 포함해 클라이언트에 바인딩합니다.

</details>

<details>
<summary>&nbsp;&nbsp;<b>트랜잭션 & 파이프라인</b></summary>

<br/>

```typescript
// 트랜잭션 (MULTI/EXEC)
const tx = client.multi();
tx.set('key', 'value');
tx.incr('counter');
const results = await tx.exec(); // WATCH한 키가 바뀌었다면 null

// 파이프라인 (원시 커맨드)
const replies = await client.send([
  ['set', 'a', '1'],
  ['incr', 'counter'],
  ['get', 'a']
]);

// 요청 하나에만 적용할 타임아웃(0이면 끔)과, blpop()처럼 처리되는 원시 블로킹 커맨드
await client.send([['INFO']], { timeout: 1_000 });
const job = await client.send([['BLPOP', 'jobs', '30']], { blockingTimeout: 30_000 });
```

- `exec()`는 `MULTI`, 쌓인 커맨드, `EXEC`를 `send()` 한 번으로 보내고 원시 응답을 돌려줍니다. 쌓인 호출의 `{ buffer: true }` 같은 옵션은 적용되지 않습니다.
- 커맨드를 하나도 쌓지 못한 호출이 있거나 `send()`가 거부하는 커맨드가 있으면 `exec()`는 실패합니다. 이때 `discard()`처럼 `UNWATCH`를 보냅니다.
- 쌓인 호출은 동기 구간만 트랜잭션에 들어갑니다. 자기가 쌓은 커맨드의 응답을 `await`하면 그 자리에서 멈추고, 다른 것을 `await`하면 나머지는 트랜잭션 밖에서 실행됩니다. 인자는 쌓기 전에 검사하세요.
- 트랜잭션에 쌓는 호출은 인자를 한 번 더 넘기므로, 펼쳐 넘길 수 있는 항목 수가 직접 호출의 절반쯤입니다. 더 큰 커맨드는 `send()`로 보내세요.
- 서버가 `MULTI`를 거부하면(`@transaction` 권한 없음) 쌓인 커맨드는 따로 실행되고 `exec()`는 `[MULTI]` 에러로 실패합니다.
- 재연결로 `WATCH`가 풀리면 다음 `EXEC`는 `DISCARD`로 바뀌어 `null`을 돌려줍니다. 직접 보낸 `MULTI`가 풀리면 `MULTI`, `EXEC`, `DISCARD`, `RESET` 말고는 모두 거부합니다.
- Redis 7.2 이상은 다른 응답이 남아 있으면 실패한 `AUTH`의 에러를 보내지 않습니다. 그래서 `AUTH`와 `HELLO`는 블로킹 커맨드를 포함해 앞선 응답이 모두 온 뒤에 보냅니다. 뒤의 커맨드는 그 응답을 기다리고, 타임아웃은 커맨드를 보낼 때부터 잽니다.
- `send()`는 같은 배치에서 다른 커맨드 뒤에 오거나 트랜잭션 안에 있는 `AUTH`와 `HELLO`를 거부합니다. 그 순간 서버에 RESP3 push가 남아 있으면 이때도 에러 응답이 오지 않아 `AUTH`가 타임아웃됩니다.

</details>

<details>
<summary>&nbsp;&nbsp;<b>Pub/Sub</b></summary>

<br/>

```typescript
client.on('message', (channel, message) => {
  console.log(`${channel}: ${message}`);
});
await client.subscribe('events');
```

- 클러스터 노드는 더 이상 맡지 않는 슬롯의 샤드 채널 구독을 `SUNSUBSCRIBE` 응답과 똑같은 메시지로 해지합니다. 이때 보낸 `SUNSUBSCRIBE`가 이 메시지를 응답으로 받으면 실제 응답은 다음 커맨드로 넘어갑니다.

</details>

<details>
<summary>&nbsp;&nbsp;<b>블로킹 커맨드</b></summary>

<br/>

```typescript
// BLPOP 계열은 응답할 때까지 연결 전체를 점유하므로 전용 클라이언트를 쓰세요
const worker = new SolidisFeaturedClient({ host: '127.0.0.1', port: 6379 });

const job = await worker.blpop(['jobs'], 0); // 타임아웃 0은 무한 대기
```

- 기한은 `commandTimeout`에 블로킹 타임아웃을 더한 값이고, 무한 대기이거나 `commandTimeout`이 `0`이면 기한이 없습니다.
- 기한이 지나면 연결을 리셋하므로 늦게 온 응답이 다른 커맨드로 가지 않습니다. 다만 서버가 아직 실행하지 않은 커맨드는 리셋 뒤에 실행되어, 아무도 받지 않는 값을 꺼낼 수 있습니다.
- `send()`도 블로킹 타임아웃을 밀리초 단위 `blockingTimeout`으로 넘기면 같은 방식으로 처리합니다. `0`은 무한 대기입니다.
- `migrate()`도 `timeout`을 같은 방식으로 기한에 더하고, `0` 이하는 서버처럼 1,000ms로 계산합니다. `shutdown()`은 중단(`abort`)이 아니면 기한 없이 연결이 닫히기를 기다립니다.

</details>

<details>
<summary>&nbsp;&nbsp;<b>큰 정수</b></summary>

<br/>

```typescript
const views = await client.incr('views', { bigint: true }); // bigint
```

- 커맨드는 정수를 `number`로 돌려주고, TTL이나 타임시리즈 타임스탬프처럼 `Number.MAX_SAFE_INTEGER`를 넘는 값은 에러로 처리합니다. 커맨드는 이미 실행된 상태이며, 정확한 값은 `cause`에 `bigint`로 담깁니다.
- INCR, INCRBY, DECR, DECRBY, HINCRBY, BITFIELD, BITFIELD_RO는 `{ bigint: true }`를 넘기면 정수를 모두 `bigint`로 돌려주고, 반환 타입도 그에 맞게 바뀝니다.
- INCRBYFLOAT는 반올림된 `number`를, HINCRBYFLOAT는 서버가 보낸 텍스트를 그대로 돌려줍니다.

</details>

<details>
<summary>&nbsp;&nbsp;<b>바이너리 값</b></summary>

<br/>

```typescript
await client.set('image', Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

const image = await client.get('image', { buffer: true });           // Buffer | null
const images = await client.mget('image', 'logo', { buffer: true }); // (Buffer | null)[]
```

| `Buffer`                  | 커맨드                                                                                                                                                         |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 그대로 저장               | SET, SETNX, SETEX, PSETEX, GETSET, SETRANGE, APPEND, MSET, MSETNX, HSET, HSETNX, HMSET, LPUSH, RPUSH, LPUSHX, RPUSHX, LSET, LINSERT, XADD, RESTORE             |
| 비교할 값                 | LINSERT, LREM, LPOS, SMISMEMBER, DELEX, SET                                                                                                                    |
| 그 밖의 인자              | PUBLISH, SPUBLISH(메시지) · FUNCTION RESTORE(덤프) · BF.LOADCHUNK, CF.LOADCHUNK(청크) · AUTH, HELLO(자격 증명) · `send()`(모든 인자)                           |
| `{ buffer: true }`로 읽기 | GET, GETDEL, GETEX, GETRANGE, MGET, HGET, HMGET, HGETALL, HVALS, LINDEX, LRANGE, LPOP, RPOP, LMOVE, BLMOVE, RPOPLPUSH, BRPOPLPUSH, BLPOP, BRPOP, LMPOP, BLMPOP |

- `Buffer` 응답은 수신한 청크(최대 64KB)의 뷰입니다. 오래 보관하려면 `Buffer.from()`으로 복사하세요.
- `send()`는 커맨드 배열을 복사하지만 그 안의 `Buffer`는 복사하지 않습니다. 커맨드가 끝날 때까지 `Buffer`를 바꾸지 마세요.
- 필드 이름(HGETALL, HSCAN, 스트림)과 RESP3 맵 키는 `send()`에서도 UTF-8로 디코딩합니다. UTF-8이 아닌 이름은 서로 겹칠 수 있으니 바이너리 데이터는 값에 담으세요.
- 스트림, 셋, 정렬 셋 읽기와 HSCAN, HRANDFIELD, GETSET, SORT, SORT_RO, LCS는 값을 UTF-8 문자열로 돌려줍니다. 바이너리 값은 `send()`로 읽으세요.
- DUMP와 FUNCTION DUMP는 페이로드를 latin1 문자열로 돌려줍니다. `restore()`나 `functionRestore()`에 그대로 넘기거나, `Buffer.from(value, 'latin1')`로 바이트를 읽으세요.
- MGET과 HMGET은 마지막 인자가 `undefined`이면 키가 아니라 옵션이 없는 것으로 봅니다.

</details>

<details>
<summary>&nbsp;&nbsp;<b>함께 쓸 수 없는 옵션</b></summary>

<br/>

```typescript
await client.set('key', 'value', { expireInSeconds: 60, setIfKeyNotExists: true });

// 타입 에러: SET은 만료 옵션과 조건 옵션을 하나씩만 받습니다
await client.set('key', 'value', { expireInSeconds: 60, keepOriginalTimeToLive: true });
```

옵션 타입은 커맨드가 받는 옵션 조합만 허용합니다. NX와 XX 중 하나, BYSCORE와 BYLEX 중 하나만 받고, BYLEX와 WITHSCORES는 함께 쓸 수 없는 식입니다. 항목 목록과 레코드는 검사하지 않아 비어 있어도 그대로 보냅니다. 다만 전체에 적용되는 `latencyReset([])`, `commandDocs([])`, `prefixes: []`를 준 `clientTracking()`은 거부합니다.

</details>

<details>
<summary>&nbsp;&nbsp;<b>스트림</b></summary>

<br/>

```typescript
const entries = await client.xrange('jobs', '-', '+');
const pending = await client.xpending('jobs', 'workers', '-', '+', 10);
```

- 엔트리 필드는 레코드에 담깁니다. 같은 이름이 반복되면 마지막 값만 남고, 정수 형태의 이름은 오름차순으로 앞에 옵니다. `xadd()`도 레코드를 받고, `send()`는 필드와 값 쌍을 그대로 돌려줍니다.
- RESP3에서 `xread()`나 `xreadgroup()`에 같은 키를 두 번 넘기면, 맵에는 키가 하나만 들어가므로 마지막 결과만 남습니다.
- `deliveryTime`은 `xpending()`에서는 유휴 시간, `xinfoStream(key, true)`에서는 마지막 전달 시각(Unix 시간)이며, 단위는 모두 밀리초입니다.
- `justid`를 준 `xautoclaim()`은 ID를 `fields`가 빈 엔트리로 돌려주고, `justid`를 준 `xclaim()`은 ID만 돌려줍니다.

</details>

<br/>

<div id="benchmark">

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Bar%20Chart.png?raw=true" alt="Bar Chart" width="25" height="25" /> 벤치마크

<div align="center">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" /> 다른 Node.js Redis 클라이언트보다 최대 5.1배 빠름 <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Rocket.png?raw=true" alt="Rocket" width="25" height="25" />

**클라이언트 5종과 비교한 벤치마크 19개 중 19개 1위**

<sub>linux x64 · Node.js v22.23.3 · Redis 8.10.2 · 2026-10-08</sub>

#### 순위

|                                                                                                                                                                                        | 클라이언트   | 버전  |    1위 횟수 |  처리량 ↑ | 작업당 CPU ↓ |     최대 메모리 ↓ |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------- | :---- | ----------: | --------: | -----------: | ----------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **solidis**  | 0.5.0 | **19** / 19 | **1.00x** |    **1.00x** |         **1.00x** |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | node-redis   | 6.3.0 |      0 / 19 |     0.73x |        1.10x |             0.88x |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | speedkey     | 0.4.2 |      0 / 19 |     0.49x |        2.03x | 0.40x<sup>†</sup> |
|                                                                                                                                                                                     4. | iovalkey     | 0.4.0 |      0 / 19 |     0.43x |        2.21x |             1.35x |
|                                                                                                                                                                                     5. | ioredis      | 6.0.0 |      0 / 19 |     0.42x |        2.24x |             1.28x |
|                                                                                                                                                                                     6. | valkey-glide | 2.5.3 |      0 / 19 |     0.39x |        2.54x | 0.94x<sup>†</sup> |

<sub>모든 벤치마크의 기하평균, `solidis` 대비 · <sup>†</sup> 네이티브 메모리 제외</sub>

#### 초당 작업 수

<sub>작업 100,000회 × 동시 실행 10,000 · 1 KB 페이로드 · 10회 측정</sub>

|                                                                                                                                                                                        | 벤치마크                                                                                                       | **solidis** |           ioredis |          iovalkey | node-redis |      valkey-glide |          speedkey |                                                                                                                                                                          배율                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------- | ----------: | ----------------: | ----------------: | ---------: | ----------------: | ----------------: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **트랜잭션**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup>                                    |  **100.7K** |             23.7K |             24.7K |      51.3K | 38.8K<sup>1</sup> |             35.9K | **2.0x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | **트랜잭션 혼합**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup>                                                 |   **65.9K** |             13.0K |             13.8K |      35.2K | 20.6K<sup>1</sup> |             25.2K | **1.9x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup>                                               |  **157.8K** |             75.8K |             83.9K |      89.9K | 24.8K<sup>2</sup> | 68.0K<sup>2</sup> | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
|                                                                                                                                                                                     4. | **Set 변경**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup>                               |   **99.2K** |             36.6K |             37.0K |      65.7K | 43.4K<sup>3</sup> | 60.8K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     5. | **파이프라인 혼합**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup>                               |   **78.9K** |             35.9K |             35.8K |      52.8K | 34.8K<sup>3</sup> | 41.6K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     6. | **Set**<br/><sup><kbd>SET</kbd></sup>                                                                          |  **152.4K** |             79.4K |             79.4K |     102.3K |             60.6K |             81.5K |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     7. | **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup>                                      |   **95.3K** |             45.9K |             44.9K |      65.6K | 43.6K<sup>3</sup> | 55.5K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     8. | **비트랜잭션**<br/><sup><kbd>SET PX</kbd> <kbd>GET</kbd></sup>                                                 |   **97.5K** |             43.5K |             44.6K |      70.7K | 38.5K<sup>3</sup> | 49.1K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     9. | **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup>                                                   |  **103.5K** |             46.4K |             49.8K |      75.8K | 43.4K<sup>3</sup> | 62.8K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    10. | **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup>                                |   **88.4K** |             36.7K |             38.7K |      65.0K | 36.4K<sup>3</sup> | 47.1K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    11. | **Set 조회**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup>                           |   **73.8K** |             31.1K |             31.2K |      55.4K | 32.7K<sup>3</sup> | 39.3K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    12. | **Hash 변경**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup>                                 |   **83.3K** |             35.7K |             38.1K |      65.3K | 33.3K<sup>3</sup> | 39.9K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    13. | **Hash 왕복**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup>                                |   **92.5K** |             42.1K |             44.5K |      73.6K | 38.0K<sup>3</sup> | 41.9K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    14. | **List 범위**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup>                               |   **69.9K** |             30.2K |             32.1K |      55.8K | 30.6K<sup>3</sup> | 38.8K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    15. | **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup>                                    |   **63.6K** |             30.7K |             30.8K |      53.9K | 25.3K<sup>3</sup> | 27.3K<sup>3</sup> |                                                                           **1.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    16. | **List 변경**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup> |   **60.9K** |             21.6K |             22.0K |      52.0K | 25.3K<sup>3</sup> | 30.8K<sup>3</sup> |                                                                           **1.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    17. | **Get**<br/><sup><kbd>GET</kbd></sup>                                                                          |  **184.6K** |            105.5K |            106.4K |     161.2K |             67.9K |             89.5K |                                                                           **1.1x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    18. | **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIG GET</kbd></sup>                                         |  **119.2K** | 54.7K<sup>4</sup> | 56.8K<sup>4</sup> |     116.4K | 48.2K<sup>3</sup> | 51.3K<sup>3</sup> |                                                                                                                                                                        **1.0x**                                                                                                                                                                         |
|                                                                                                                                                                                    19. | **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup>                                                     |  **160.2K** |             81.2K |             81.1K |     158.4K | 65.5K<sup>3</sup> | 81.5K<sup>3</sup> |                                                                                                                                                                        **1.0x**                                                                                                                                                                         |

<sub>반복 측정 중앙값 · 가장 빠른 값은 굵게 · 배율 = `solidis` ÷ 다른 클라이언트 중 가장 빠른 값</sub>

<details>
<summary><sub>참고</sub></summary>

<sub><sup>1</sup> MULTI/EXEC 트랜잭션을 원자적 배치로 전송</sub><br/>
<sub><sup>2</sup> Pub/Sub에 RESP3 필요</sub><br/>
<sub><sup>3</sup> 커맨드 순서를 지키려고 작업마다 배치 하나로 전송</sub><br/>
<sub><sup>4</sup> INFO는 오토 파이프라이닝하지 않음</sub>

</details>

</div>

<details>
<summary>&nbsp;&nbsp;<b>상세 지표</b></summary>

| 벤치마크                                                                                                                           | 라이브러리               |  ops/s | cmds/s |      p50 |      p95 |       p99 |     p99.9 | CPU/작업 | GC/작업 |               메모리 |   편차 |
| :--------------------------------------------------------------------------------------------------------------------------------- | :----------------------- | -----: | -----: | -------: | -------: | --------: | --------: | -------: | ------: | -------------------: | -----: |
| **트랜잭션**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              | 100.7K | 503.6K |  89.62ms | 160.89ms |  187.93ms |  201.56ms |  19.50µs |  3.33µs |             301.2 MB |  ±3.1% |
|                                                                                                                                    | ioredis                  |  23.7K | 118.4K | 408.16ms | 493.31ms |  569.04ms |  633.58ms |  72.91µs |  9.91µs |             645.0 MB |  ±3.8% |
|                                                                                                                                    | iovalkey                 |  24.7K | 123.4K | 385.78ms | 469.66ms |  640.65ms |  681.94ms |  72.37µs | 10.44µs |             688.9 MB |  ±4.6% |
|                                                                                                                                    | node-redis               |  51.3K | 256.4K | 180.99ms | 241.51ms |  262.25ms |  283.96ms |  37.55µs |  6.06µs |             541.2 MB |  ±3.2% |
|                                                                                                                                    | valkey-glide<sup>1</sup> |  38.8K | 193.8K | 238.38ms | 299.82ms |  313.65ms |  331.55ms |  53.28µs |  9.07µs | 379.3 MB<sup>†</sup> |  ±1.8% |
|                                                                                                                                    | speedkey                 |  35.9K | 179.5K | 277.21ms | 342.64ms |  364.43ms |  373.82ms |  59.37µs |  5.33µs | 204.3 MB<sup>†</sup> |  ±2.7% |
| **트랜잭션 혼합**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                 | **solidis**              |  65.9K | 395.2K | 140.12ms | 201.08ms |  237.46ms |  284.97ms |  31.54µs |  4.60µs |             356.4 MB |  ±2.3% |
|                                                                                                                                    | ioredis                  |  13.0K |  78.0K | 746.91ms | 912.98ms | 1034.59ms | 1075.32ms | 119.43µs | 12.04µs |             671.7 MB |  ±3.5% |
|                                                                                                                                    | iovalkey                 |  13.8K |  82.7K | 692.32ms | 855.17ms |  930.75ms | 1092.18ms | 114.38µs | 12.96µs |             724.4 MB |  ±4.3% |
|                                                                                                                                    | node-redis               |  35.2K | 211.3K | 264.23ms | 359.42ms |  369.14ms |  379.24ms |  54.67µs |  8.05µs |             492.9 MB |  ±0.8% |
|                                                                                                                                    | valkey-glide<sup>1</sup> |  20.6K | 123.3K | 486.44ms | 527.04ms |  541.73ms |  550.40ms | 104.77µs | 14.67µs | 364.7 MB<sup>†</sup> |  ±0.7% |
|                                                                                                                                    | speedkey                 |  25.2K | 151.2K | 381.09ms | 523.65ms |  570.81ms |  587.39ms |  84.36µs |  6.29µs | 216.3 MB<sup>†</sup> |  ±7.9% |
| **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup><br/><sub>1 KB</sub>                                               | **solidis**              | 157.8K | 157.8K |  14.19ms |  30.18ms |   53.59ms |   58.67ms |  12.57µs |  1.66µs |             152.1 MB |  ±3.1% |
|                                                                                                                                    | ioredis                  |  75.8K |  75.8K |  31.61ms |  52.96ms |   69.93ms |   77.67ms |  24.97µs |  3.24µs |             266.5 MB |  ±2.4% |
|                                                                                                                                    | iovalkey                 |  83.9K |  83.9K |  30.02ms |  50.37ms |   56.81ms |   66.56ms |  23.90µs |  3.60µs |             284.3 MB |  ±2.7% |
|                                                                                                                                    | node-redis               |  89.9K |  89.9K |  29.30ms |  46.92ms |   61.58ms |   79.30ms |  14.90µs |  4.60µs |             176.7 MB |  ±6.4% |
|                                                                                                                                    | valkey-glide<sup>2</sup> |  24.8K |  24.8K |  96.71ms | 146.53ms |  159.84ms |  311.67ms | 101.62µs |  4.24µs | 111.7 MB<sup>†</sup> |  ±2.3% |
|                                                                                                                                    | speedkey<sup>2</sup>     |  68.0K |  68.0K |  33.34ms |  51.49ms |   65.81ms |   75.61ms |  31.70µs |  1.51µs |  54.6 MB<sup>†</sup> |  ±1.5% |
| **Set 변경**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              |  99.2K | 297.5K |  92.36ms | 136.70ms |  161.30ms |  174.51ms |  22.82µs |  3.71µs |             275.2 MB |  ±1.6% |
|                                                                                                                                    | ioredis                  |  36.6K | 109.9K | 271.34ms | 295.79ms |  312.23ms |  315.78ms |  56.54µs |  7.67µs |             277.1 MB |  ±1.5% |
|                                                                                                                                    | iovalkey                 |  37.0K | 111.1K | 271.05ms | 303.97ms |  333.62ms |  338.95ms |  57.32µs |  7.65µs |             320.4 MB |  ±4.3% |
|                                                                                                                                    | node-redis               |  65.7K | 197.0K | 146.10ms | 179.20ms |  189.35ms |  200.47ms |  23.34µs |  5.33µs |             244.2 MB |  ±2.7% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  43.4K | 130.3K | 221.61ms | 252.08ms |  260.20ms |  266.54ms |  49.84µs |  7.37µs | 349.7 MB<sup>†</sup> |  ±1.5% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  60.8K | 182.5K | 159.42ms | 195.46ms |  199.81ms |  205.00ms |  36.52µs |  2.81µs |  90.2 MB<sup>†</sup> |  ±8.0% |
| **파이프라인 혼합**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              |  78.9K | 236.7K | 114.56ms | 192.41ms |  225.44ms |  241.48ms |  27.68µs |  5.21µs |             344.8 MB |  ±4.5% |
|                                                                                                                                    | ioredis                  |  35.9K | 107.8K | 264.87ms | 331.38ms |  343.45ms |  346.09ms |  56.96µs |  8.47µs |             475.6 MB |  ±1.7% |
|                                                                                                                                    | iovalkey                 |  35.8K | 107.5K | 265.28ms | 333.22ms |  346.68ms |  351.72ms |  58.40µs |  9.46µs |             569.1 MB |  ±1.6% |
|                                                                                                                                    | node-redis               |  52.8K | 158.5K | 179.20ms | 222.02ms |  241.53ms |  279.57ms |  30.73µs |  7.69µs |             270.7 MB |  ±2.5% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  34.8K | 104.3K | 270.86ms | 324.85ms |  337.63ms |  347.35ms |  59.71µs | 10.25µs | 336.4 MB<sup>†</sup> |  ±1.8% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  41.6K | 124.8K | 233.59ms | 268.75ms |  282.41ms |  305.11ms |  52.51µs |  4.41µs |  77.0 MB<sup>†</sup> |  ±4.2% |
| **Set**<br/><sup><kbd>SET</kbd></sup><br/><sub>1 KB</sub>                                                                          | **solidis**              | 152.4K | 152.4K |  57.05ms |  98.72ms |  126.39ms |  145.74ms |  15.42µs |  2.56µs |             262.2 MB |  ±1.2% |
|                                                                                                                                    | ioredis                  |  79.4K |  79.4K | 113.90ms | 186.13ms |  198.77ms |  212.15ms |  24.91µs |  3.51µs |             259.0 MB |  ±1.6% |
|                                                                                                                                    | iovalkey                 |  79.4K |  79.4K | 114.73ms | 176.77ms |  189.84ms |  229.35ms |  25.52µs |  3.71µs |             274.3 MB |  ±7.0% |
|                                                                                                                                    | node-redis               | 102.3K | 102.3K |  90.87ms | 120.81ms |  130.57ms |  139.44ms |  15.75µs |  3.93µs |             178.9 MB |  ±3.8% |
|                                                                                                                                    | valkey-glide             |  60.6K |  60.6K | 153.75ms | 182.90ms |  190.55ms |  196.51ms |  35.87µs |  4.09µs | 216.5 MB<sup>†</sup> |  ±1.2% |
|                                                                                                                                    | speedkey                 |  81.5K |  81.5K | 119.08ms | 137.45ms |  145.12ms |  156.49ms |  29.43µs |  1.74µs | 101.3 MB<sup>†</sup> |  ±6.2% |
| **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup><br/><sub>1 KB</sub>                                      | **solidis**              |  95.3K | 286.0K |  94.73ms | 157.68ms |  195.93ms |  321.33ms |  22.40µs |  4.33µs |             331.4 MB |  ±7.3% |
|                                                                                                                                    | ioredis                  |  45.9K | 137.8K | 204.06ms | 263.53ms |  272.33ms |  279.61ms |  43.34µs |  7.19µs |             448.5 MB |  ±1.3% |
|                                                                                                                                    | iovalkey                 |  44.9K | 134.6K | 215.23ms | 278.96ms |  306.87ms |  322.89ms |  44.88µs |  7.97µs |             484.6 MB |  ±5.5% |
|                                                                                                                                    | node-redis               |  65.6K | 196.8K | 142.20ms | 180.82ms |  191.95ms |  203.52ms |  24.44µs |  6.71µs |             248.7 MB |  ±4.1% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  43.6K | 130.7K | 217.28ms | 256.20ms |  267.41ms |  276.35ms |  46.83µs |  8.79µs | 409.8 MB<sup>†</sup> |  ±1.9% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  55.5K | 166.5K | 186.55ms | 208.57ms |  218.95ms |  238.14ms |  39.66µs |  3.60µs | 100.2 MB<sup>†</sup> |  ±5.9% |
| **비트랜잭션**<br/><sup><kbd>SET PX</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                 | **solidis**              |  97.5K | 194.9K |  91.85ms | 164.61ms |  196.08ms |  215.22ms |  21.96µs |  3.85µs |             276.5 MB |  ±2.0% |
|                                                                                                                                    | ioredis                  |  43.5K |  87.0K | 215.33ms | 293.80ms |  300.29ms |  316.82ms |  46.17µs |  6.15µs |             373.8 MB |  ±1.7% |
|                                                                                                                                    | iovalkey                 |  44.6K |  89.1K | 215.02ms | 280.90ms |  301.06ms |  307.90ms |  44.01µs |  6.49µs |             394.2 MB |  ±1.8% |
|                                                                                                                                    | node-redis               |  70.7K | 141.4K | 132.98ms | 167.31ms |  178.58ms |  191.14ms |  23.08µs |  5.44µs |             229.7 MB |  ±1.5% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  38.5K |  76.9K | 241.10ms | 287.24ms |  299.65ms |  310.94ms |  54.65µs |  8.49µs | 314.1 MB<sup>†</sup> |  ±1.4% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  49.1K |  98.2K | 197.52ms | 263.74ms |  273.51ms |  283.53ms |  43.93µs |  3.58µs | 167.4 MB<sup>†</sup> |  ±9.6% |
| **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup><br/><sub>1 KB</sub>                                                   | **solidis**              | 103.5K | 206.9K |  91.13ms | 124.77ms |  143.89ms |  162.67ms |  20.81µs |  3.21µs |             347.9 MB |  ±3.9% |
|                                                                                                                                    | ioredis                  |  46.4K |  92.7K | 218.12ms | 237.36ms |  245.38ms |  261.68ms |  49.90µs |  5.82µs |             416.9 MB |  ±2.3% |
|                                                                                                                                    | iovalkey                 |  49.8K |  99.6K | 200.51ms | 230.73ms |  241.00ms |  270.13ms |  43.07µs |  5.60µs |             431.2 MB |  ±2.8% |
|                                                                                                                                    | node-redis               |  75.8K | 151.6K | 125.73ms | 160.24ms |  178.72ms |  193.97ms |  23.79µs |  5.05µs |             320.8 MB |  ±2.0% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  43.4K |  86.7K | 218.42ms | 256.38ms |  271.15ms |  276.57ms |  49.76µs |  7.07µs | 279.2 MB<sup>†</sup> |  ±1.7% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  62.8K | 125.6K | 158.59ms | 196.65ms |  205.95ms |  210.81ms |  34.60µs |  3.16µs | 170.8 MB<sup>†</sup> |  ±3.6% |
| **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup><br/><sub>1 KB</sub>                                | **solidis**              |  88.4K | 265.2K | 101.85ms | 164.10ms |  200.68ms |  230.03ms |  25.94µs |  4.01µs |             340.1 MB |  ±6.0% |
|                                                                                                                                    | ioredis                  |  36.7K | 110.0K | 273.50ms | 308.57ms |  350.07ms |  357.84ms |  57.54µs |  7.89µs |             401.2 MB |  ±3.2% |
|                                                                                                                                    | iovalkey                 |  38.7K | 116.1K | 263.77ms | 286.75ms |  292.44ms |  297.33ms |  55.86µs |  7.92µs |             389.7 MB |  ±1.7% |
|                                                                                                                                    | node-redis               |  65.0K | 195.1K | 148.87ms | 176.80ms |  185.67ms |  191.88ms |  24.39µs |  5.57µs |             282.6 MB |  ±2.8% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  36.4K | 109.3K | 260.27ms | 301.34ms |  311.14ms |  344.21ms |  55.15µs |  8.82µs | 353.2 MB<sup>†</sup> |  ±2.0% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  47.1K | 141.3K | 205.68ms | 262.68ms |  275.64ms |  278.96ms |  44.96µs |  3.55µs | 250.4 MB<sup>†</sup> |  ±5.0% |
| **Set 조회**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup><br/><sub>1 KB</sub>                           | **solidis**              |  73.8K | 221.5K | 122.83ms | 187.84ms |  222.38ms |  236.07ms |  31.21µs |  4.98µs |             328.3 MB |  ±2.9% |
|                                                                                                                                    | ioredis                  |  31.1K |  93.4K | 328.99ms | 359.85ms |  405.11ms |  435.44ms |  68.06µs |  8.82µs |             377.9 MB |  ±2.6% |
|                                                                                                                                    | iovalkey                 |  31.2K |  93.6K | 322.73ms | 357.31ms |  367.72ms |  375.85ms |  67.84µs |  9.23µs |             386.4 MB |  ±1.5% |
|                                                                                                                                    | node-redis               |  55.4K | 166.2K | 172.33ms | 210.32ms |  225.50ms |  236.42ms |  28.81µs |  6.72µs |             265.9 MB |  ±1.7% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  32.7K |  98.1K | 293.52ms | 336.99ms |  345.97ms |  352.81ms |  65.10µs |  9.33µs | 321.8 MB<sup>†</sup> |  ±1.5% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  39.3K | 117.9K | 246.92ms | 320.08ms |  334.71ms |  351.13ms |  54.67µs |  4.14µs |  79.7 MB<sup>†</sup> |  ±5.0% |
| **Hash 변경**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup><br/><sub>1 KB</sub>                                 | **solidis**              |  83.3K | 250.0K | 109.71ms | 162.77ms |  176.26ms |  197.47ms |  27.60µs |  3.86µs |             389.4 MB |  ±3.0% |
|                                                                                                                                    | ioredis                  |  35.7K | 107.1K | 276.09ms | 308.65ms |  340.90ms |  358.32ms |  70.09µs |  7.83µs |             452.0 MB |  ±1.7% |
|                                                                                                                                    | iovalkey                 |  38.1K | 114.2K | 261.65ms | 292.94ms |  311.30ms |  318.67ms |  66.76µs |  8.01µs |             452.7 MB |  ±2.4% |
|                                                                                                                                    | node-redis               |  65.3K | 195.9K | 144.09ms | 185.38ms |  192.97ms |  198.58ms |  26.38µs |  4.66µs |             330.4 MB |  ±2.7% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  33.3K |  99.9K | 294.93ms | 330.74ms |  342.18ms |  356.41ms |  63.12µs |  9.02µs | 334.9 MB<sup>†</sup> |  ±1.3% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  39.9K | 119.8K | 243.52ms | 299.46ms |  317.91ms |  330.12ms |  52.47µs |  3.94µs | 192.1 MB<sup>†</sup> |  ±2.8% |
| **Hash 왕복**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup><br/><sub>1 KB</sub>                                | **solidis**              |  92.5K | 277.6K |  93.68ms | 168.86ms |  202.67ms |  227.88ms |  24.99µs |  3.77µs |             377.2 MB |  ±4.3% |
|                                                                                                                                    | ioredis                  |  42.1K | 126.3K | 234.39ms | 291.05ms |  425.20ms |  445.46ms |  52.44µs |  6.74µs |             488.4 MB |  ±4.8% |
|                                                                                                                                    | iovalkey                 |  44.5K | 133.6K | 228.94ms | 275.72ms |  295.75ms |  303.14ms |  50.46µs |  6.91µs |             503.7 MB |  ±4.7% |
|                                                                                                                                    | node-redis               |  73.6K | 220.9K | 126.25ms | 172.10ms |  183.33ms |  198.16ms |  23.66µs |  4.52µs |             338.0 MB |  ±5.6% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  38.0K | 113.9K | 244.41ms | 309.66ms |  320.46ms |  329.74ms |  53.68µs |  8.00µs | 326.0 MB<sup>†</sup> |  ±2.9% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  41.9K | 125.7K | 231.40ms | 295.19ms |  313.10ms |  336.22ms |  51.63µs |  3.73µs | 167.1 MB<sup>†</sup> |  ±5.2% |
| **List 범위**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              |  69.9K | 209.8K | 126.84ms | 193.98ms |  210.90ms |  244.86ms |  32.49µs |  4.96µs |             382.6 MB |  ±1.5% |
|                                                                                                                                    | ioredis                  |  30.2K |  90.6K | 328.74ms | 365.19ms |  395.65ms |  414.20ms |  83.00µs |  9.95µs |             443.3 MB |  ±1.5% |
|                                                                                                                                    | iovalkey                 |  32.1K |  96.2K | 315.71ms | 344.10ms |  355.59ms |  364.69ms |  76.27µs |  9.92µs |             488.0 MB |  ±2.2% |
|                                                                                                                                    | node-redis               |  55.8K | 167.3K | 167.00ms | 215.52ms |  224.07ms |  234.10ms |  31.38µs |  6.23µs |             327.7 MB |  ±1.1% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  30.6K |  91.7K | 317.69ms | 365.49ms |  382.91ms |  399.14ms |  70.80µs | 10.16µs | 301.8 MB<sup>†</sup> |  ±1.1% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  38.8K | 116.5K | 249.10ms | 311.48ms |  327.65ms |  333.98ms |  55.73µs |  4.81µs | 180.2 MB<sup>†</sup> |  ±4.8% |
| **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              |  63.6K | 190.9K | 135.77ms | 213.77ms |  243.95ms |  254.15ms |  34.39µs |  6.21µs |             398.9 MB |  ±2.0% |
|                                                                                                                                    | ioredis                  |  30.7K |  92.2K | 311.12ms | 371.80ms |  382.60ms |  391.00ms |  63.08µs |  8.48µs |             481.3 MB |  ±1.8% |
|                                                                                                                                    | iovalkey                 |  30.8K |  92.3K | 313.85ms | 367.92ms |  390.06ms |  397.52ms |  62.82µs |  8.99µs |             494.3 MB |  ±2.1% |
|                                                                                                                                    | node-redis               |  53.9K | 161.8K | 176.55ms | 224.46ms |  237.40ms |  246.75ms |  30.59µs |  7.61µs |             327.2 MB |  ±2.4% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  25.3K |  76.0K | 366.32ms | 451.84ms |  495.74ms |  550.42ms |  79.44µs | 12.18µs | 388.6 MB<sup>†</sup> |  ±2.0% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  27.3K |  81.9K | 359.57ms | 441.96ms |  485.70ms |  506.40ms |  74.68µs |  6.08µs | 208.2 MB<sup>†</sup> |  ±3.3% |
| **List 변경**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup><br/><sub>1 KB</sub> | **solidis**              |  60.9K | 304.6K | 152.59ms | 219.83ms |  279.90ms |  297.95ms |  34.62µs |  4.33µs |             432.5 MB |  ±4.1% |
|                                                                                                                                    | ioredis                  |  21.6K | 108.2K | 461.84ms | 487.03ms |  494.98ms |  498.10ms | 102.20µs | 15.09µs |             439.0 MB |  ±1.2% |
|                                                                                                                                    | iovalkey                 |  22.0K | 110.2K | 452.17ms | 475.01ms |  479.00ms |  481.18ms | 103.26µs | 14.99µs |             437.7 MB |  ±0.9% |
|                                                                                                                                    | node-redis               |  52.0K | 260.2K | 176.77ms | 240.68ms |  251.63ms |  262.19ms |  35.60µs |  4.14µs |             378.1 MB |  ±1.5% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  25.3K | 126.5K | 392.42ms | 431.54ms |  444.68ms |  455.07ms |  80.44µs | 11.82µs | 333.9 MB<sup>†</sup> |  ±0.8% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  30.8K | 153.8K | 319.25ms | 394.61ms |  403.21ms |  407.01ms |  70.77µs |  5.09µs | 103.1 MB<sup>†</sup> |  ±2.5% |
| **Get**<br/><sup><kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                                          | **solidis**              | 184.6K | 184.6K |  50.07ms |  81.22ms |   94.68ms |  104.98ms |  11.72µs |  1.73µs |             198.3 MB |  ±3.4% |
|                                                                                                                                    | ioredis                  | 105.5K | 105.5K |  87.33ms | 131.25ms |  144.32ms |  150.30ms |  18.58µs |  3.06µs |             284.4 MB |  ±1.6% |
|                                                                                                                                    | iovalkey                 | 106.4K | 106.4K |  87.66ms | 128.46ms |  142.94ms |  151.63ms |  19.22µs |  3.32µs |             258.2 MB |  ±2.0% |
|                                                                                                                                    | node-redis               | 161.2K | 161.2K |  54.44ms |  87.95ms |   96.01ms |  102.93ms |  14.65µs |  2.07µs |              92.0 MB |  ±2.2% |
|                                                                                                                                    | valkey-glide             |  67.9K |  67.9K | 121.54ms | 223.02ms |  293.85ms |  372.79ms |  34.61µs |  3.19µs |  83.7 MB<sup>†</sup> |  ±4.7% |
|                                                                                                                                    | speedkey                 |  89.5K |  89.5K | 107.37ms | 139.97ms |  153.29ms |  171.80ms |  25.94µs |  2.14µs |   8.5 MB<sup>†</sup> |  ±1.7% |
| **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIG GET</kbd></sup>                                                             | **solidis**              | 119.2K | 238.3K |  73.49ms | 138.66ms |  159.23ms |  169.53ms |  18.48µs |  3.00µs |             302.7 MB |  ±2.3% |
|                                                                                                                                    | ioredis<sup>4</sup>      |  54.7K | 109.5K | 171.27ms | 244.90ms |  266.28ms |  284.27ms |  33.81µs |  4.89µs |             296.0 MB |  ±3.3% |
|                                                                                                                                    | iovalkey<sup>4</sup>     |  56.8K | 113.6K | 164.71ms | 231.97ms |  249.99ms |  268.53ms |  34.00µs |  5.34µs |             321.0 MB |  ±2.0% |
|                                                                                                                                    | node-redis               | 116.4K | 232.8K |  77.44ms | 127.94ms |  141.36ms |  150.06ms |  18.22µs |  2.99µs |             266.9 MB |  ±4.5% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  48.2K |  96.4K | 188.37ms | 296.58ms |  336.49ms |  368.85ms |  45.95µs |  8.22µs | 335.1 MB<sup>†</sup> |  ±5.8% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  51.3K | 102.6K | 191.51ms | 232.31ms |  249.57ms |  258.94ms |  42.04µs |  4.45µs | 203.8 MB<sup>†</sup> |  ±2.4% |
| **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup>                                                                         | **solidis**              | 160.2K | 320.4K |  55.27ms | 110.54ms |  132.27ms |  200.76ms |  12.80µs |  2.33µs |             268.4 MB |  ±4.3% |
|                                                                                                                                    | ioredis                  |  81.2K | 162.4K | 113.14ms | 177.92ms |  184.53ms |  189.74ms |  25.74µs |  4.62µs |             350.9 MB |  ±1.6% |
|                                                                                                                                    | iovalkey                 |  81.1K | 162.2K | 116.06ms | 165.65ms |  174.51ms |  180.60ms |  26.40µs |  4.85µs |             376.9 MB |  ±2.8% |
|                                                                                                                                    | node-redis               | 158.4K | 316.8K |  56.60ms |  91.51ms |  111.92ms |  152.19ms |  14.13µs |  2.34µs |             248.1 MB | ±16.5% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  65.5K | 131.0K | 142.89ms | 184.46ms |  208.37ms |  324.82ms |  32.49µs |  6.20µs | 366.3 MB<sup>†</sup> |  ±2.9% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  81.5K | 163.0K | 126.68ms | 158.80ms |  173.31ms |  184.79ms |  27.58µs |  2.64µs | 276.4 MB<sup>†</sup> |  ±8.1% |

<sub><sup>†</sup> 네이티브 메모리 제외</sub>

</details>

<details>
<summary>&nbsp;&nbsp;<b>환경</b></summary>

| 항목                 | 값                                                                                                                                                                                              |
| :------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU                  | AMD EPYC 7763 64-Core Processor (스레드 4개)<br/>AMD EPYC 9V74 80-Core Processor (스레드 4개)<br/>AMD EPYC 9V45 96-Core Processor (스레드 4개)<br/>INTEL(R) XEON(R) PLATINUM 8573C (스레드 4개) |
| 메모리               | 15.6 GB                                                                                                                                                                                         |
| 운영체제             | linux x64 (6.17.0-1022-azure)                                                                                                                                                                   |
| Node.js              | v22.23.3                                                                                                                                                                                        |
| 서버                 | Redis 8.10.2                                                                                                                                                                                    |
| 클라이언트           | solidis 0.5.0, ioredis 6.0.0, iovalkey 0.4.0, node-redis 6.3.0, valkey-glide 2.5.3, speedkey 0.4.2                                                                                              |
| 모드                 | `autopipeline`                                                                                                                                                                                  |
| 페이로드 크기        | 1 KB                                                                                                                                                                                            |
| 샘플당 작업 수       | 100,000                                                                                                                                                                                         |
| 워밍업 작업 수       | 1,000                                                                                                                                                                                           |
| 클라이언트당 연결 수 | 1                                                                                                                                                                                               |
| 연결당 동시 실행     | 10,000                                                                                                                                                                                          |
| 측정 횟수            | 10                                                                                                                                                                                              |
| 쿨다운               | 2500ms                                                                                                                                                                                          |
| 날짜                 | 2026-10-08 15:30:29 UTC                                                                                                                                                                         |

</details>

<details>
<summary>&nbsp;&nbsp;<b>측정 방법</b></summary>

- 샘플마다 **별도 워커 스레드**에서 실행하므로 GC와 JIT 상태가 다음 샘플로 이어지지 않습니다.
- 샘플마다 라이브러리 순서를 **바꾸고**, 매번 서버를 **비우고 안정화**한 뒤 측정합니다.
- 모든 라이브러리가 미리 정해 둔 같은 **바이너리 페이로드**를 쓰고, 측정이 끝나면 모든 응답과 Pub/Sub 메시지를 검사합니다.
- 트랜잭션과 트랜잭션 혼합은 작업마다 배치 하나로 보냅니다(`batch` 모드). Pub/Sub은 한 번에 최대 4MB의 메시지를 발행하고 모두 도착할 때까지 기다립니다.
- 처리량은 반복 측정의 **중앙값**이고, 편차는 σ / 중앙값입니다.
- 지연 시간은 설정한 동시 실행 수에서 **작업마다** 재고, 모든 반복을 합쳐 계산합니다.
- 작업당 CPU는 측정 구간의 **프로세스 CPU 시간**(user + system)을 작업 수로 나눈 값으로, GC와 네이티브 스레드를 포함합니다. 작업당 GC는 GC 일시정지 시간을 같은 방식으로 나눈 값입니다.
- 메모리는 측정 구간 동안 워커의 힙과 `ArrayBuffer` 메모리(모든 `Buffer` 포함)가 가장 많이 늘어난 양이며, 20ms마다 잽니다. 네이티브 코드가 쓰는 메모리는 포함하지 않습니다. 실제 애플리케이션처럼 응답은 검사할 때까지 보관합니다.
- 클라이언트는 **커맨드 타임아웃, 레디 체크, 재연결을 끄고** 파이프라이닝 제한 없이 실행합니다. Valkey GLIDE와 speedkey는 재연결을 끌 수 없고, 요청마다 최대 10분을 기다립니다. ioredis와 iovalkey는 오토 파이프라이닝을 쓰고, Valkey GLIDE와 speedkey는 RESP2에서 응답을 바이트로 디코딩합니다.
- 같은 방식으로 실행할 수 없었던 결과에는 **번호를 붙이고** 표 아래에 이유를 적습니다.
- 비교 대상: npm 주간 다운로드가 1,000회 이상이고, 컴파일 없이 설치되며, 바이너리 값을 그대로 다루는 Node.js TCP 클라이언트 전부입니다. 제외: redis-fast-driver(네이티브 빌드 필요), tedis(값을 문자열로 반환), @upstash/redis 같은 HTTP 클라이언트. Valkey GLIDE는 Windows 빌드가 없습니다.

</details>

</div>

## 기능

<table>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" /> 성능

- `setImmediate`로 파이프라인 자동 병합
- 선형 시간 증분 RESP 파서
- bulk 응답은 복사 없이 뷰로 반환
- Node가 파이프라인을 `writev` 하나로 묶음

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Electric%20Plug.png?raw=true" alt="Electric Plug" width="25" height="25" /> 프로토콜

- RESP2, RESP3 지원 (스트리밍 응답 제외)
- RESP3 응답 타입 15가지 전부
- push가 커맨드 응답을 가로채지 않음
- 안전 범위를 넘는 정수는 `bigint`로
- 바이너리 세이프 `Buffer` 입출력

</td>
</tr>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Shield.png?raw=true" alt="Shield" width="25" height="25" /> 안정성

- 지터를 넣은 지수 백오프로 자동 재연결
- 핸드셰이크와 레디 체크 뒤에 커맨드 전송
- AUTH, 프로토콜, SELECT, 구독 자동 복구
- 재연결로 깨진 트랜잭션은 중단
- 파이프라인, `send()`, 블로킹 커맨드별 타임아웃
- 장애 시 처리 중인 요청을 바로 실패 처리

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Locked.png?raw=true" alt="Locked" width="25" height="25" /> 보안

- TLS (`rediss://` 또는 `tls` 옵션)
- ACL 사용자 이름과 비밀번호
- 디버그 항목에 인자를 남기지 않음
- 서버가 되돌려준 인자를 에러에서 가림
- bulk 크기 제한과 512단계 중첩 제한

</td>
</tr>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/Bullseye.png?raw=true" alt="Bullseye" width="25" height="25" /> 타입 안전성

- TypeScript `strict`, 커맨드마다 입출력 타입
- 함께 쓸 수 없는 옵션은 컴파일할 때 에러
- 런타임 응답 검사 (`tryReplyToString`, ...)
- 표준 `cause`로 이어지는 에러 클래스

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/Puzzle%20Piece.png?raw=true" alt="Puzzle Piece" width="25" height="25" /> 확장성

- `.extend()`로 필요한 커맨드만 조합 (트리 셰이킹)
- 클라이언트에 바인딩되는 커스텀 커맨드
- 커맨드만 노출하는 트랜잭션

</td>
</tr>
</table>

## 설정

<details>
<summary><b>전체 옵션</b></summary>

```typescript
const client = new SolidisClient({
  // 연결
  uri: 'redis://user:pass@localhost:6379/0', // redis[s]://[user[:password]@]host[:port][/db]
  host: '127.0.0.1',
  port: 6379,
  tls: { /* tls.ConnectionOptions */ },
  lazyConnect: false,                     // true면 connect()나 첫 커맨드에서 연결

  // 인증
  authentication: { username: 'user', password: 'pass' }, // username을 비우면 default 사용자
  database: 0,

  // 프로토콜 / 복구
  clientName: 'solidis',
  protocol: 'RESP2',                      // 'RESP2' | 'RESP3'
  autoReconnect: true,
  enableReadyCheck: true,
  maxReadyCheckRetries: 100,
  readyCheckInterval: 100,
  maxConnectionRetries: 20,
  connectionRetryDelay: 100,              // 실패할 때마다 두 배, 그 값의 50–100%로 지터 적용
  maxConnectionRetryDelay: 2000,
  autoRecovery: {
    database: true,
    subscribe: true,
    ssubscribe: true,
    psubscribe: true,
  },

  // 타임아웃 (ms)
  commandTimeout: 5000,                   // 0이면 끔, send(commands, { timeout })로 요청마다 지정
  connectionTimeout: 2000,

  // 성능
  maxCommandsPerPipeline: 300,
  rejectOnPartialPipelineError: false,

  // 파서
  parser: {
    maxBulkStringLength: 536_870_912,     // 512MB
  },

  // 기타
  maxEventListenersForClient: 10_240,
  debug: false,
});
```

직접 지정한 옵션이 `uri`보다 우선합니다.

</details>

## 아키텍처

```mermaid
graph TD
  subgraph SolidisClient
    direction LR
    Conn[Connection<br/><sub>TCP · TLS · Reconnect</sub>]
    Req[Requester<br/><sub>Queue · Pipeline · Timeout</sub>]
    Parse[Parser<br/><sub>RESP2 · RESP3 · Binary-safe</sub>]
    PS[PubSub<br/><sub>Channel · Pattern · Shard</sub>]
    DM[Debug<br/><sub>debug event · No arguments</sub>]
  end

  Conn -->|socket data| Req
  Req -->|raw bytes| Parse
  Req -->|push messages| PS
  DM -.->|injected| Conn
  DM -.->|injected| Req

  style Conn fill:#1a1a2e,stroke:#f5a623,color:#fff
  style Req fill:#1a1a2e,stroke:#f5a623,color:#fff
  style Parse fill:#1a1a2e,stroke:#f5a623,color:#fff
  style PS fill:#1a1a2e,stroke:#f5a623,color:#fff
  style DM fill:#16213e,stroke:#555,color:#aaa
```

```mermaid
sequenceDiagram
  participant App
  participant Client as SolidisClient
  participant Req as Requester
  participant Socket as TCP Socket

  App->>Client: await client.set('key', 'value')
  Client->>Req: enqueue command
  Note over Req: setImmediate batching
  Req->>Socket: write pipeline
  Socket-->>Req: RESP reply bytes
  Req-->>Client: parsed reply
  Client-->>App: 'OK'
```

| 모듈           | 역할                                             |
| :------------- | :----------------------------------------------- |
| **Connection** | TCP/TLS 소켓, 재연결 백오프                      |
| **Requester**  | 큐, 파이프라인 분할, 응답 매칭, 타임아웃         |
| **Parser**     | 바이너리 세이프 RESP 증분 디코딩                 |
| **PubSub**     | 채널·패턴·샤드 상태, 메시지 전달                 |
| **Debug**      | 커맨드 이름만 담고 인자는 담지 않는 `debug` 항목 |

## 이벤트

```typescript
client.on('connect', () => {});                    // TCP 연결됨
client.on('ready', () => {});                      // 핸드셰이크 완료, 커맨드 전송 가능
client.on('close', (error) => {});                 // 끊김 (준비된 적이 있으면 autoReconnect 재연결)
client.on('reconnecting', (attempt, delay) => {}); // 재연결을 시도할 때마다
client.on('reconnected', () => {});                // 재연결 성공
client.on('end', () => {});                        // 클라이언트 종료 (quit)
client.on('error', (error) => {});                 // 비치명적 에러 (리스너가 없으면 emitWarning())
client.on('drain', () => {});                      // 쓰기 버퍼가 비워짐
client.on('message', (channel, message) => {});    // Pub/Sub 메시지
client.on('pmessage', (pattern, channel, message) => {});
client.on('smessage', (channel, message) => {});   // 샤드 채널 메시지
client.on('subscribe', (channel, count) => {});    // psubscribe, ssubscribe, unsubscribe 계열도 같음
client.on('push', (reply) => {});                  // 그 밖의 push (예: client tracking 무효화)
client.on('debug', (entry) => {});                 // 디버그 항목
```

## 에러 처리

```typescript
import { RespError, SolidisCommandError, unwrapSolidisError } from '@vcms-io/solidis';

try {
  await client.incr('key');
} catch (error) {
  if (error instanceof SolidisCommandError && error.cause instanceof RespError) {
    console.log(error.cause.code); // 'WRONGTYPE', 'ERR', ...
  }

  const chain = unwrapSolidisError(error); // 에러와 모든 cause
}
```

| 에러 클래스              | 발생 조건                                                                             |
| :----------------------- | :------------------------------------------------------------------------------------ |
| `SolidisCommandError`    | 서버 에러(`cause`는 `RespError`), 예상과 다른 응답, 거부된 옵션                       |
| `SolidisClientError`     | 잘못된 `uri`, 제한 시간 안에 준비되지 않음, 핸드셰이크 거부, quit, 예외를 던진 리스너 |
| `SolidisConnectionError` | 연결 실패와 타임아웃, 잘못된 포트, 연결 끊김, 재시도 소진, 연결 거부                  |
| `SolidisRequesterError`  | 커맨드 타임아웃, 연결이 끊겨 보내지 못한 커맨드, 잘못되거나 거부된 `send()` 커맨드    |
| `SolidisParserError`     | 잘못된 RESP, 너무 큰 bulk string이나 줄, 512단계를 넘는 중첩                          |
| `SolidisPubSubError`     | 잘못된 Pub/Sub 이벤트, 예외를 던진 Pub/Sub·push 리스너                                |

<details>
<summary>&nbsp;&nbsp;<b>참고</b></summary>

- 선언된 타입의 인자로 생긴 에러는 모두 `SolidisError`이고, 원인은 표준 `cause`로 이어집니다.
- 메시지에는 커맨드 이름(`[INCR] ERR ...`)만 붙고 인자는 붙지 않습니다. 따옴표 안의 텍스트가 인자에 들어 있으면 메시지와 `cause` 모두에서 `'***'`로 가리고, Lua 에러는 첫 따옴표부터 가립니다. 따옴표 없이 되돌려준 값(GEOADD 좌표, `redis.error_reply()` 텍스트, FUNCTION LOAD의 함수 이름)은 그대로 남습니다.
- 4,096자보다 긴 메시지는 잘리고, 잘린 메시지에서 가린 부분이 있으면 끝까지 가립니다.
- 인자는 선언된 타입으로만 검사합니다. JavaScript에서 배열 자리에 문자열, 객체 자리에 배열을 넘기거나 ioredis식으로 `set(key, value, 'EX', 10)`을 쓰면 다른 커맨드가 됩니다. 필드 레코드는 객체만 받습니다.
- ESM과 CJS 빌드의 클라이언트와 커맨드는 섞어 쓸 수 있지만, 에러 클래스는 빌드마다 따로라서 `instanceof`는 같은 빌드의 에러에만 맞습니다.
- TS.MADD, BF.MADD, BF.INSERT는 거부된 항목을 결과 안의 `RespError`로 돌려줍니다.
- `send()`, `pipeline()`, `exec()`의 원시 결과에 든 에러 응답은 서버 텍스트를 그대로 둡니다.

</details>

## 확장

```bash
npm install @vcms-io/solidis-extensions
```

| 확장                                                                                                       | 설명                                     |
| :--------------------------------------------------------------------------------------------------------- | :--------------------------------------- |
| [**SpinLock**](https://github.com/vcms-io/solidis-extensions/blob/main/sources/domains/spinlock/README.md) | 가벼운 Redis 기반 뮤텍스 (단일 인스턴스) |
| [**RedLock**](https://github.com/vcms-io/solidis-extensions/blob/main/sources/domains/redlock/README.md)   | 장애에 강한 분산 잠금 (Redlock 알고리즘) |

## 기여하기

```bash
git clone https://github.com/vcms-io/solidis.git && cd solidis
npm install && npm run build
npm run lint:check # 린트, 포맷, 타입 테스트
SOLIDIS_TEST_PORT=6380 npm test # 테스트가 데이터를 지우므로 버려도 되는 서버를 쓰세요
```

<sub>TypeScript strict · 외부 의존성 추가 금지 · 번들 크기 최소화 · SemVer</sub>

## 라이선스

MIT · [LICENSE](/LICENSE) 참고

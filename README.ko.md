<h1 align="center"><img src="./assets/solidis.png" alt="Solidis" width="50"/></h1>

<h3 align="center">
  <b>Node.js에서 가장 빠른 Redis 클라이언트.<br/>의존성 제로, 프로덕션에서 검증된 안정성.</b>
</h3>

<br/>

<p align="center">
  <a href="https://www.npmjs.com/package/@vcms-io/solidis"><img src="https://img.shields.io/npm/v/@vcms-io/solidis.svg?style=flat-square&labelColor=000&color=f5a623" alt="npm"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/coverage-100%25-brightgreen?style=flat-square&labelColor=000" alt="coverage"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square&labelColor=000" alt="deps"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/min_bundle-<29KB-blue?style=flat-square&labelColor=000" alt="bundle"></a>
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
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Package.png?raw=true" alt="Package" width="32" height="32" /><br/><strong>383</strong><br/><sub>커맨드</sub></td>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Test%20Tube.png?raw=true" alt="Test Tube" width="32" height="32" /><br/><strong>25K+</strong><br/><sub>테스트 코드 줄 수</sub></td>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Animals/Feather.png?raw=true" alt="Feather" width="32" height="32" /><br/><strong>&lt; 29KB</strong><br/><sub>최소 번들</sub></td>
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
> **번들을 더 줄이려면** `SolidisClient`와 `.extend()`로 쓰는 커맨드만 가져오세요. 트리 쉐이킹하면 **29KB 미만**입니다.

<details>
<summary>&nbsp;&nbsp;<b>트리 쉐이킹 클라이언트</b></summary>

<br/>

```typescript
import { SolidisClient } from '@vcms-io/solidis';
import { get } from '@vcms-io/solidis/command/get';
import { set } from '@vcms-io/solidis/command/set';

const client = new SolidisClient({ host: '127.0.0.1', port: 6379 }).extend({ get, set });
```

`extend()`는 객체가 직접 가진 함수를 클라이언트에 바인딩합니다.

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

// 파이프라인 (raw)
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
- 서버가 `MULTI`를 거부하면(`@transaction` 권한 없음) 쌓인 커맨드는 따로 실행되고 `exec()`는 `[MULTI]` 에러로 실패합니다.
- 재연결로 `WATCH`가 풀리면 다음 `EXEC`는 `DISCARD`로 바뀌어 `null`을 돌려줍니다. 직접 보낸 `MULTI`가 풀리면 `MULTI`, `EXEC`, `DISCARD`, `RESET` 말고는 모두 거부합니다.

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

</details>

<details>
<summary>&nbsp;&nbsp;<b>블로킹 커맨드</b></summary>

<br/>

```typescript
// BLPOP 계열은 응답할 때까지 연결 전체를 점유하므로 전용 클라이언트를 쓰세요
const worker = new SolidisFeaturedClient({ host: '127.0.0.1', port: 6379 });

const job = await worker.blpop(['jobs'], 0); // 타임아웃 0은 무한 대기
```

- 기한은 `commandTimeout`에 블로킹 타임아웃을 더한 값이고, 무한 대기면 기한이 없습니다.
- 기한이 지나면 연결을 리셋하므로 늦게 온 응답이 다른 커맨드로 가지 않습니다. 다만 서버가 아직 실행하지 않은 커맨드는 리셋 뒤에 실행되어, 아무도 받지 않는 값을 꺼낼 수 있습니다.
- `send()`도 블로킹 타임아웃을 밀리초 단위 `blockingTimeout`으로 넘기면 같은 방식으로 처리합니다. `0`은 무한 대기입니다.

</details>

<details>
<summary>&nbsp;&nbsp;<b>2^53을 넘는 정수</b></summary>

<br/>

```typescript
const views = await client.incr('views', { bigint: true }); // bigint
```

- INCR, INCRBY, DECR, DECRBY, HINCRBY, BITFIELD, BITFIELD_RO는 `number`를 돌려주고, `Number.MAX_SAFE_INTEGER`를 넘는 결과는 에러로 처리합니다. 커맨드는 이미 실행된 상태이며, 정확한 값은 `cause`에 `bigint`로 담깁니다.
- `{ bigint: true }`를 넘기면 항상 `bigint`를 돌려주고, 반환 타입도 그에 맞게 바뀝니다.
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
| 그대로 저장               | SET, SETNX, SETEX, PSETEX, GETSET, SETRANGE, APPEND, MSET, MSETNX, HSET, HSETNX, HMSET, LPUSH, RPUSH, LPUSHX, RPUSHX, LSET, XADD, RESTORE                      |
| 비교할 값                 | LINSERT, LREM, LPOS, SMISMEMBER, DELEX, SET                                                                                                                    |
| 그 밖의 인자              | PUBLISH, SPUBLISH(메시지) · BF.LOADCHUNK, CF.LOADCHUNK(청크) · AUTH, HELLO(자격 증명) · `send()`(모든 인자)                                                    |
| `{ buffer: true }`로 읽기 | GET, GETDEL, GETEX, GETRANGE, MGET, HGET, HMGET, HGETALL, HVALS, LINDEX, LRANGE, LPOP, RPOP, LMOVE, BLMOVE, RPOPLPUSH, BRPOPLPUSH, BLPOP, BRPOP, LMPOP, BLMPOP |

- `Buffer` 응답은 응답이 도착한 청크(최대 64KB)의 뷰입니다. 오래 보관하려면 `Buffer.from()`으로 복사하세요.
- `send()`는 커맨드 배열을 복사하지만 그 안의 `Buffer`는 복사하지 않습니다. 커맨드가 끝날 때까지 `Buffer`를 바꾸지 마세요.
- 필드 이름(HGETALL, HSCAN, 스트림)과 RESP3 맵 키는 `send()`에서도 UTF-8로 디코딩합니다. UTF-8이 아닌 이름은 서로 겹칠 수 있으니 바이너리 데이터는 값에 담으세요.
- 스트림 읽기, HSCAN, HRANDFIELD는 값을 UTF-8 문자열로 돌려줍니다. 이들에서 바이너리 값을 읽으려면 `send()`를 쓰세요.
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

옵션 타입은 커맨드가 받는 조합만 허용합니다. NX와 XX 중 하나, BYSCORE와 BYLEX 중 하나만 받고, BYLEX와 WITHSCORES는 함께 쓸 수 없는 식입니다.

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

</details>

<br/>

<div id="benchmark">

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Bar%20Chart.png?raw=true" alt="Bar Chart" width="25" height="25" /> 벤치마크

<div align="center">

# <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" /> Solidis vs ioredis, iovalkey, node-redis, valkey-glide, speedkey

<small>측정일 2026-10-05 02:30:21 · linux x64 · Node.js v22.23.0 · Redis 8.10.2</small>

### 벤치마크 **19**개 중 **19**개에서 가장 빠름 · 처리량은 다음으로 빠른 클라이언트의 평균 **1.5배** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Rocket.png?raw=true" alt="Rocket" width="25" height="25" />

### 순위

|                                                                                                                                                                                        | 클라이언트   | 버전  |    1위 횟수 |    처리량 | 작업당 CPU |       최대 메모리 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------- | :---- | ----------: | --------: | ---------: | ----------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **solidis**  | 0.5.0 | **19** / 19 | **1.00x** |  **1.00x** |         **1.00x** |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | node-redis   | 6.3.0 |      0 / 19 |     0.68x |      1.10x |             0.94x |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | speedkey     | 0.4.2 |      0 / 19 |     0.48x |      1.94x | 0.52x<sup>†</sup> |
|                                                                                                                                                                                     4. | iovalkey     | 0.4.0 |      0 / 19 |     0.42x |      2.16x |             1.41x |
|                                                                                                                                                                                     5. | ioredis      | 6.0.0 |      0 / 19 |     0.40x |      2.21x |             1.31x |
|                                                                                                                                                                                     6. | valkey-glide | 2.5.3 |      0 / 19 |     0.39x |      2.48x | 1.01x<sup>†</sup> |

<sub>처리량, 작업당 CPU, 최대 메모리는 모든 벤치마크의 기하평균이며, `solidis`(1.00x) 대비 값입니다. 처리량은 높을수록, CPU와 메모리는 낮을수록 좋습니다.</sub>

<sub><sup>†</sup> 클라이언트가 네이티브 코드에서 쓰는 메모리는 포함하지 않습니다.</sub>

### 초당 작업 수

_작업 100,000회 × 동시 실행 10,000 · 1 KB 페이로드 · 클라이언트마다 5회 측정_

|                                                                                                                                                                                        | 벤치마크                                                                                                       | **solidis** |            ioredis |           iovalkey | node-redis |       valkey-glide |           speedkey |                                                                                                                                                                          차이                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------- | ----------: | -----------------: | -----------------: | ---------: | -----------------: | -----------------: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **트랜잭션 혼합**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup>                                                 |  **132.5K** |              28.4K |              30.5K |      61.4K |  42.1K<sup>1</sup> |              46.7K | **2.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | **트랜잭션**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup>                                    |  **166.5K** |              35.4K |              39.5K |      78.2K |  66.8K<sup>1</sup> |              55.7K | **2.1x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup>                                               |  **303.1K** |             145.2K |             159.9K |     166.8K |  43.0K<sup>2</sup> | 130.9K<sup>2</sup> | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
|                                                                                                                                                                                     4. | **Set**<br/><sup><kbd>SET</kbd></sup>                                                                          |  **356.0K** |             145.1K |             154.9K |     212.1K |             114.2K |             168.2K | **1.7x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
|                                                                                                                                                                                     5. | **Set 조회**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup>                           |  **162.9K** |              60.5K |              61.5K |     104.1K |  71.3K<sup>3</sup> |  84.3K<sup>3</sup> |                                                                                    **1.6x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     6. | **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup>                                |  **140.3K** |              57.9K |              60.7K |      93.2K |  59.9K<sup>3</sup> |  69.1K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     7. | **Set 변경**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup>                               |  **152.9K** |              55.1K |              66.2K |     104.6K |  72.6K<sup>3</sup> |  96.4K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     8. | **Hash 변경**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup>                                 |  **130.5K** |              56.2K |              60.4K |      89.5K |  52.2K<sup>3</sup> |  63.4K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     9. | **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup>                                      |  **175.4K** |              74.9K |              75.2K |     120.8K |  82.1K<sup>3</sup> |  93.4K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    10. | **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup>                                                     |  **262.4K** |             125.4K |             127.9K |     186.6K | 102.3K<sup>3</sup> | 139.8K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    11. | **파이프라인 혼합**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup>                               |  **159.4K** |              74.3K |              74.3K |     113.4K |  74.6K<sup>3</sup> |  84.4K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    12. | **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup>                                                   |  **147.7K** |              62.8K |              67.4K |     105.1K |  63.3K<sup>3</sup> |  74.3K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    13. | **List 범위**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup>                               |  **131.2K** |              54.7K |              56.8K |      94.2K |  58.8K<sup>3</sup> |  73.5K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    14. | **비트랜잭션**<br/><sup><kbd>SET PX</kbd> <kbd>GET</kbd></sup>                                                 |  **197.5K** |              83.1K |              84.7K |     144.5K |  85.1K<sup>3</sup> | 104.4K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    15. | **Hash 왕복**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup>                                |  **147.7K** |              68.2K |              71.9K |     110.6K |  61.0K<sup>3</sup> |  71.0K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    16. | **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIG GET</kbd></sup>                                         |  **221.2K** | 110.6K<sup>4</sup> | 115.2K<sup>4</sup> |     169.3K |  90.6K<sup>3</sup> |  96.6K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    17. | **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup>                                    |  **139.5K** |              59.4K |              58.5K |     107.8K |  54.8K<sup>3</sup> |  54.8K<sup>3</sup> |                                                                           **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    18. | **List 변경**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup> |  **109.2K** |              40.6K |              42.5K |      90.9K |  49.3K<sup>3</sup> |  58.3K<sup>3</sup> |                                                                           **1.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    19. | **Get**<br/><sup><kbd>GET</kbd></sup>                                                                          |  **349.1K** |             198.9K |             194.9K |     331.9K |             112.3K |             183.3K |                                                                           **1.1x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |

<sub>반복 측정의 초당 작업 수 중앙값이며, 벤치마크마다 가장 빠른 클라이언트를 굵게 표시합니다. 차이 = `solidis` ÷ 다른 클라이언트 중 가장 빠른 값.</sub>

<sub><sup>1</sup> 배치에 MULTI와 EXEC를 넣을 수 없어, 그 사이의 커맨드를 원자적 배치로 보냅니다</sub><br/>
<sub><sup>2</sup> Pub/Sub에는 RESP3가 필요해 RESP3로 구독합니다</sub><br/>
<sub><sup>3</sup> 동시에 보낸 커맨드의 순서를 지키지 않아, 작업마다 배치 하나로 보냅니다</sub><br/>
<sub><sup>4</sup> INFO는 오토 파이프라이닝하지 않습니다</sub>

</div>

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Bar%20Chart.png?raw=true" alt="Bar Chart" width="25" height="25" /> 상세 지표

<sub>라이브러리별 초당 작업 수와 커맨드 수, 지연 시간(p50 / p95 / p99 / p99.9), 작업당 CPU와 GC 시간, 최대 메모리, 편차입니다.</sub>

<details>
<summary>상세 지표 펼치기</summary>

| 벤치마크                                                                                                                           | 라이브러리               |  ops/s | cmds/s |      p50 |      p95 |      p99 |    p99.9 | CPU/작업 | GC/작업 |               메모리 |  편차 |
| :--------------------------------------------------------------------------------------------------------------------------------- | :----------------------- | -----: | -----: | -------: | -------: | -------: | -------: | -------: | ------: | -------------------: | ----: |
| **트랜잭션 혼합**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                 | **solidis**              | 132.5K | 794.9K |  70.12ms | 104.60ms | 123.74ms | 131.58ms |  17.12µs |  2.11µs |             355.0 MB | ±1.6% |
|                                                                                                                                    | ioredis                  |  28.4K | 170.3K | 346.12ms | 370.91ms | 378.29ms | 383.11ms |  58.56µs |  6.27µs |             675.9 MB | ±1.0% |
|                                                                                                                                    | iovalkey                 |  30.5K | 183.1K | 324.02ms | 352.41ms | 360.89ms | 366.14ms |  56.09µs |  7.13µs |             712.0 MB | ±1.0% |
|                                                                                                                                    | node-redis               |  61.4K | 368.3K | 158.42ms | 186.61ms | 197.37ms | 199.98ms |  30.49µs |  4.13µs |             493.8 MB | ±1.3% |
|                                                                                                                                    | valkey-glide<sup>1</sup> |  42.1K | 252.4K | 232.70ms | 256.89ms | 271.39ms | 279.51ms |  53.67µs |  7.64µs | 357.9 MB<sup>†</sup> | ±0.4% |
|                                                                                                                                    | speedkey                 |  46.7K | 280.2K | 207.57ms | 241.01ms | 244.79ms | 248.64ms |  43.02µs |  3.37µs | 216.3 MB<sup>†</sup> | ±0.4% |
| **트랜잭션**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              | 166.5K | 832.7K |  54.54ms | 100.24ms | 119.63ms | 134.20ms |  12.32µs |  1.66µs |             276.9 MB | ±2.6% |
|                                                                                                                                    | ioredis                  |  35.4K | 177.0K | 277.25ms | 299.72ms | 306.31ms | 310.86ms |  46.15µs |  5.35µs |             623.5 MB | ±1.6% |
|                                                                                                                                    | iovalkey                 |  39.5K | 197.6K | 247.88ms | 274.28ms | 286.69ms | 296.23ms |  43.91µs |  5.81µs |             659.2 MB | ±1.5% |
|                                                                                                                                    | node-redis               |  78.2K | 390.8K | 121.76ms | 142.90ms | 147.92ms | 151.11ms |  25.00µs |  3.54µs |             530.2 MB | ±1.1% |
|                                                                                                                                    | valkey-glide<sup>1</sup> |  66.8K | 333.9K | 140.20ms | 165.62ms | 185.39ms | 190.10ms |  32.32µs |  5.31µs | 383.2 MB<sup>†</sup> | ±0.7% |
|                                                                                                                                    | speedkey                 |  55.7K | 278.4K | 174.39ms | 206.23ms | 224.50ms | 228.87ms |  35.68µs |  2.99µs | 204.5 MB<sup>†</sup> | ±1.1% |
| **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup><br/><sub>1 KB</sub>                                               | **solidis**              | 303.1K | 303.1K |   7.57ms |  19.79ms |  24.66ms |  27.60ms |   6.78µs |  0.83µs |             145.4 MB | ±3.5% |
|                                                                                                                                    | ioredis                  | 145.2K | 145.2K |  16.85ms |  28.90ms |  36.91ms |  39.20ms |  13.07µs |  1.68µs |             221.4 MB | ±1.4% |
|                                                                                                                                    | iovalkey                 | 159.9K | 159.9K |  15.75ms |  29.35ms |  33.67ms |  38.27ms |  12.74µs |  1.81µs |             235.2 MB | ±2.2% |
|                                                                                                                                    | node-redis               | 166.8K | 166.8K |  16.38ms |  24.13ms |  28.24ms |  30.51ms |   8.19µs |  2.25µs |             178.3 MB | ±2.0% |
|                                                                                                                                    | valkey-glide<sup>2</sup> |  43.0K |  43.0K |  52.65ms |  81.81ms |  85.68ms |  89.88ms |  57.68µs |  2.29µs | 110.0 MB<sup>†</sup> | ±0.7% |
|                                                                                                                                    | speedkey<sup>2</sup>     | 130.9K | 130.9K |  16.22ms |  23.84ms |  28.77ms |  32.57ms |  19.00µs |  1.02µs |  62.8 MB<sup>†</sup> | ±1.8% |
| **Set**<br/><sup><kbd>SET</kbd></sup><br/><sub>1 KB</sub>                                                                          | **solidis**              | 356.0K | 356.0K |  24.78ms |  46.98ms |  57.86ms |  64.22ms |   6.55µs |  1.04µs |             181.3 MB | ±3.7% |
|                                                                                                                                    | ioredis                  | 145.1K | 145.1K |  62.17ms |  93.33ms | 100.36ms | 104.09ms |  12.90µs |  1.97µs |             312.3 MB | ±2.3% |
|                                                                                                                                    | iovalkey                 | 154.9K | 154.9K |  59.48ms |  86.10ms |  92.95ms |  95.54ms |  12.70µs |  1.90µs |             271.4 MB | ±2.7% |
|                                                                                                                                    | node-redis               | 212.1K | 212.1K |  43.51ms |  51.20ms |  54.58ms |  60.20ms |   8.12µs |  1.75µs |             178.7 MB | ±2.4% |
|                                                                                                                                    | valkey-glide             | 114.2K | 114.2K |  83.73ms |  93.18ms |  96.19ms |  99.66ms |  18.27µs |  2.02µs | 217.0 MB<sup>†</sup> | ±3.3% |
|                                                                                                                                    | speedkey                 | 168.2K | 168.2K |  55.88ms |  74.43ms |  87.11ms |  92.06ms |  14.80µs |  1.06µs | 159.1 MB<sup>†</sup> | ±1.6% |
| **Set 조회**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup><br/><sub>1 KB</sub>                           | **solidis**              | 162.9K | 488.7K |  57.45ms |  88.11ms | 106.83ms | 115.27ms |  13.78µs |  2.06µs |             327.6 MB | ±3.1% |
|                                                                                                                                    | ioredis                  |  60.5K | 181.4K | 162.63ms | 191.33ms | 197.90ms | 199.53ms |  35.30µs |  4.64µs |             383.1 MB | ±1.2% |
|                                                                                                                                    | iovalkey                 |  61.5K | 184.6K | 158.74ms | 191.50ms | 196.95ms | 201.00ms |  34.73µs |  4.74µs |             400.5 MB | ±1.3% |
|                                                                                                                                    | node-redis               | 104.1K | 312.2K |  92.27ms | 105.62ms | 109.07ms | 115.38ms |  15.10µs |  3.08µs |             278.0 MB | ±1.8% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  71.3K | 214.0K | 135.26ms | 150.82ms | 155.33ms | 160.75ms |  30.18µs |  4.88µs | 321.0 MB<sup>†</sup> | ±0.8% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  84.3K | 253.0K | 115.27ms | 126.04ms | 130.79ms | 144.30ms |  24.96µs |  2.02µs |  78.1 MB<sup>†</sup> | ±1.4% |
| **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup><br/><sub>1 KB</sub>                                | **solidis**              | 140.3K | 420.9K |  65.02ms |  95.45ms | 112.17ms | 117.71ms |  16.28µs |  2.32µs |             404.2 MB | ±1.4% |
|                                                                                                                                    | ioredis                  |  57.9K | 173.6K | 168.48ms | 200.79ms | 205.04ms | 208.56ms |  37.32µs |  4.79µs |             393.1 MB | ±1.3% |
|                                                                                                                                    | iovalkey                 |  60.7K | 182.2K | 162.05ms | 186.91ms | 189.72ms | 192.45ms |  35.19µs |  4.67µs |             394.4 MB | ±1.9% |
|                                                                                                                                    | node-redis               |  93.2K | 279.5K | 103.60ms | 122.63ms | 127.58ms | 130.61ms |  17.25µs |  3.51µs |             338.6 MB | ±1.7% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  59.9K | 179.7K | 160.13ms | 182.43ms | 190.40ms | 193.48ms |  35.28µs |  6.02µs | 349.7 MB<sup>†</sup> | ±0.9% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  69.1K | 207.2K | 141.32ms | 164.73ms | 168.61ms | 172.56ms |  29.13µs |  2.24µs | 210.0 MB<sup>†</sup> | ±0.7% |
| **Set 변경**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              | 152.9K | 458.6K |  57.67ms | 104.40ms | 123.07ms | 134.32ms |  15.56µs |  2.29µs |             265.1 MB | ±1.9% |
|                                                                                                                                    | ioredis                  |  55.1K | 165.4K | 174.92ms | 196.12ms | 200.65ms | 201.32ms |  35.96µs |  4.89µs |             187.6 MB | ±5.8% |
|                                                                                                                                    | iovalkey                 |  66.2K | 198.7K | 151.80ms | 188.76ms | 191.03ms | 194.93ms |  37.43µs |  4.26µs |             294.2 MB | ±8.2% |
|                                                                                                                                    | node-redis               | 104.6K | 313.8K |  92.45ms | 105.27ms | 110.87ms | 115.11ms |  14.33µs |  3.08µs |             228.8 MB | ±1.8% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  72.6K | 217.7K | 134.47ms | 153.15ms | 159.20ms | 163.81ms |  29.02µs |  4.96µs | 342.3 MB<sup>†</sup> | ±2.7% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  96.4K | 289.2K | 102.52ms | 112.37ms | 115.10ms | 119.18ms |  22.20µs |  1.76µs | 115.0 MB<sup>†</sup> | ±1.6% |
| **Hash 변경**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup><br/><sub>1 KB</sub>                                 | **solidis**              | 130.5K | 391.6K |  69.68ms | 100.14ms | 115.13ms | 120.94ms |  17.87µs |  2.22µs |             399.9 MB | ±0.3% |
|                                                                                                                                    | ioredis                  |  56.2K | 168.6K | 174.78ms | 203.33ms | 211.24ms | 219.82ms |  44.49µs |  4.92µs |             430.7 MB | ±2.0% |
|                                                                                                                                    | iovalkey                 |  60.4K | 181.3K | 165.38ms | 176.03ms | 178.38ms | 180.51ms |  42.29µs |  4.87µs |             429.1 MB | ±3.1% |
|                                                                                                                                    | node-redis               |  89.5K | 268.4K | 106.00ms | 125.76ms | 134.81ms | 140.32ms |  18.41µs |  3.41µs |             320.4 MB | ±1.5% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  52.2K | 156.5K | 183.89ms | 208.17ms | 217.01ms | 222.77ms |  40.76µs |  6.46µs | 336.4 MB<sup>†</sup> | ±2.1% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  63.4K | 190.2K | 151.73ms | 178.17ms | 182.61ms | 185.93ms |  31.35µs |  2.37µs | 191.1 MB<sup>†</sup> | ±0.8% |
| **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup><br/><sub>1 KB</sub>                                      | **solidis**              | 175.4K | 526.1K |  51.60ms |  82.16ms |  92.27ms | 106.50ms |  12.97µs |  2.01µs |             289.9 MB | ±2.3% |
|                                                                                                                                    | ioredis                  |  74.9K | 224.6K | 130.23ms | 152.72ms | 156.33ms | 158.18ms |  25.14µs |  3.98µs |             533.4 MB | ±2.1% |
|                                                                                                                                    | iovalkey                 |  75.2K | 225.7K | 129.43ms | 149.35ms | 162.17ms | 164.92ms |  25.60µs |  4.17µs |             489.2 MB | ±1.1% |
|                                                                                                                                    | node-redis               | 120.8K | 362.4K |  79.70ms |  93.58ms |  96.63ms | 100.07ms |  13.10µs |  3.14µs |             238.8 MB | ±3.7% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  82.1K | 246.2K | 117.76ms | 132.29ms | 138.60ms | 141.98ms |  25.11µs |  4.85µs | 413.2 MB<sup>†</sup> | ±1.6% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  93.4K | 280.1K | 105.14ms | 115.74ms | 119.87ms | 124.03ms |  22.43µs |  1.78µs | 126.8 MB<sup>†</sup> | ±1.2% |
| **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup><br/><sub>1 KB</sub>                                                     | **solidis**              | 262.4K | 524.8K |  34.20ms |  52.69ms |  58.33ms |  62.51ms |   9.51µs |  1.59µs |             228.6 MB | ±2.0% |
|                                                                                                                                    | ioredis                  | 125.4K | 250.7K |  74.59ms | 109.70ms | 118.82ms | 124.46ms |  16.84µs |  2.90µs |             308.3 MB | ±3.1% |
|                                                                                                                                    | iovalkey                 | 127.9K | 255.7K |  70.72ms | 107.32ms | 113.78ms | 125.35ms |  16.92µs |  3.07µs |             329.1 MB | ±2.5% |
|                                                                                                                                    | node-redis               | 186.6K | 373.3K |  50.13ms |  59.98ms |  64.47ms |  67.42ms |   9.23µs |  2.39µs |             227.4 MB | ±2.2% |
|                                                                                                                                    | valkey-glide<sup>3</sup> | 102.3K | 204.6K |  88.66ms | 125.92ms | 156.24ms | 171.11ms |  22.60µs |  3.70µs | 391.4 MB<sup>†</sup> | ±4.9% |
|                                                                                                                                    | speedkey<sup>3</sup>     | 139.8K | 279.5K |  68.88ms |  77.58ms |  81.67ms |  83.81ms |  15.62µs |  1.51µs | 254.2 MB<sup>†</sup> | ±1.1% |
| **파이프라인 혼합**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              | 159.4K | 478.1K |  56.72ms |  88.80ms | 104.28ms | 110.44ms |  14.21µs |  2.17µs |             336.4 MB | ±1.7% |
|                                                                                                                                    | ioredis                  |  74.3K | 222.9K | 131.97ms | 158.64ms | 164.94ms | 172.81ms |  28.03µs |  4.10µs |             450.3 MB | ±2.6% |
|                                                                                                                                    | iovalkey                 |  74.3K | 223.0K | 130.91ms | 152.24ms | 158.42ms | 162.28ms |  27.40µs |  4.34µs |             522.1 MB | ±1.8% |
|                                                                                                                                    | node-redis               | 113.4K | 340.1K |  85.15ms |  98.70ms | 104.64ms | 111.44ms |  13.94µs |  3.15µs |             281.2 MB | ±1.5% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  74.6K | 223.7K | 129.56ms | 153.25ms | 161.30ms | 166.34ms |  28.57µs |  4.92µs | 339.4 MB<sup>†</sup> | ±2.0% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  84.4K | 253.1K | 115.07ms | 134.02ms | 140.54ms | 143.74ms |  24.46µs |  2.06µs | 223.8 MB<sup>†</sup> | ±0.5% |
| **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup><br/><sub>1 KB</sub>                                                   | **solidis**              | 147.7K | 295.5K |  64.49ms |  86.36ms | 100.38ms | 104.60ms |  15.41µs |  1.83µs |             350.8 MB | ±3.9% |
|                                                                                                                                    | ioredis                  |  62.8K | 125.5K | 154.87ms | 177.43ms | 182.32ms | 183.74ms |  39.05µs |  4.19µs |             385.0 MB | ±3.7% |
|                                                                                                                                    | iovalkey                 |  67.4K | 134.7K | 146.24ms | 173.38ms | 181.29ms | 189.76ms |  32.02µs |  3.91µs |             428.8 MB | ±1.9% |
|                                                                                                                                    | node-redis               | 105.1K | 210.2K |  91.82ms | 102.45ms | 106.52ms | 108.26ms |  16.33µs |  2.75µs |             313.4 MB | ±1.5% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  63.3K | 126.5K | 152.95ms | 170.14ms | 176.42ms | 185.40ms |  35.85µs |  4.82µs | 282.1 MB<sup>†</sup> | ±1.3% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  74.3K | 148.6K | 131.27ms | 155.16ms | 171.15ms | 180.26ms |  27.13µs |  2.09µs | 169.7 MB<sup>†</sup> | ±2.3% |
| **List 범위**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              | 131.2K | 393.5K |  69.95ms | 103.30ms | 109.45ms | 116.98ms |  17.80µs |  2.34µs |             417.8 MB | ±1.2% |
|                                                                                                                                    | ioredis                  |  54.7K | 164.1K | 178.30ms | 212.07ms | 224.47ms | 236.55ms |  45.99µs |  5.48µs |             449.6 MB | ±2.2% |
|                                                                                                                                    | iovalkey                 |  56.8K | 170.5K | 175.74ms | 197.62ms | 205.68ms | 208.19ms |  43.64µs |  5.26µs |             441.4 MB | ±1.6% |
|                                                                                                                                    | node-redis               |  94.2K | 282.6K | 104.29ms | 118.01ms | 125.99ms | 128.87ms |  17.91µs |  3.21µs |             319.4 MB | ±2.8% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  58.8K | 176.3K | 161.20ms | 187.31ms | 190.90ms | 196.41ms |  38.06µs |  5.60µs | 303.6 MB<sup>†</sup> | ±1.0% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  73.5K | 220.6K | 131.35ms | 158.48ms | 172.43ms | 177.30ms |  28.46µs |  2.31µs | 179.7 MB<sup>†</sup> | ±1.3% |
| **비트랜잭션**<br/><sup><kbd>SET PX</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                 | **solidis**              | 197.5K | 395.1K |  46.50ms |  76.67ms |  90.69ms |  98.33ms |  11.55µs |  1.66µs |             272.8 MB | ±1.1% |
|                                                                                                                                    | ioredis                  |  83.1K | 166.3K | 116.04ms | 142.81ms | 149.81ms | 151.03ms |  23.17µs |  3.19µs |             387.3 MB | ±1.4% |
|                                                                                                                                    | iovalkey                 |  84.7K | 169.3K | 113.36ms | 132.95ms | 137.89ms | 145.90ms |  22.46µs |  3.24µs |             390.0 MB | ±2.2% |
|                                                                                                                                    | node-redis               | 144.5K | 289.0K |  65.92ms |  75.51ms |  79.03ms |  83.40ms |  11.24µs |  2.34µs |             232.7 MB | ±0.5% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  85.1K | 170.1K | 109.85ms | 129.41ms | 140.79ms | 149.96ms |  25.84µs |  4.15µs | 311.3 MB<sup>†</sup> | ±1.5% |
|                                                                                                                                    | speedkey<sup>3</sup>     | 104.4K | 208.9K |  92.28ms | 107.85ms | 113.26ms | 119.84ms |  20.60µs |  1.81µs | 193.2 MB<sup>†</sup> | ±1.7% |
| **Hash 왕복**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup><br/><sub>1 KB</sub>                                | **solidis**              | 147.7K | 443.1K |  63.48ms |  84.71ms | 103.02ms | 109.62ms |  16.02µs |  2.07µs |             374.2 MB | ±1.8% |
|                                                                                                                                    | ioredis                  |  68.2K | 204.6K | 138.85ms | 166.02ms | 176.19ms | 181.51ms |  30.30µs |  4.22µs |             491.1 MB | ±2.1% |
|                                                                                                                                    | iovalkey                 |  71.9K | 215.6K | 133.63ms | 160.28ms | 170.04ms | 172.21ms |  31.00µs |  4.55µs |             515.4 MB | ±1.2% |
|                                                                                                                                    | node-redis               | 110.6K | 331.7K |  86.63ms | 101.35ms | 105.52ms | 110.35ms |  15.56µs |  3.05µs |             342.5 MB | ±1.1% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  61.0K | 182.9K | 154.45ms | 184.80ms | 199.99ms | 215.36ms |  34.45µs |  5.54µs | 324.6 MB<sup>†</sup> | ±1.6% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  71.0K | 213.1K | 135.19ms | 160.95ms | 166.53ms | 171.68ms |  29.42µs |  2.40µs | 167.1 MB<sup>†</sup> | ±1.4% |
| **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIG GET</kbd></sup><br/><sub>1 KB</sub>                                         | **solidis**              | 221.2K | 442.5K |  39.95ms |  73.97ms |  82.66ms |  90.49ms |  10.78µs |  1.73µs |             287.0 MB | ±2.1% |
|                                                                                                                                    | ioredis<sup>4</sup>      | 110.6K | 221.1K |  83.65ms | 124.04ms | 131.03ms | 134.61ms |  17.48µs |  2.37µs |             277.8 MB | ±2.2% |
|                                                                                                                                    | iovalkey<sup>4</sup>     | 115.2K | 230.4K |  79.88ms | 119.99ms | 124.72ms | 131.39ms |  17.14µs |  2.54µs |             306.6 MB | ±2.3% |
|                                                                                                                                    | node-redis               | 169.3K | 338.6K |  54.65ms |  74.43ms |  80.83ms |  87.86ms |  10.97µs |  2.39µs |             250.1 MB | ±2.3% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  90.6K | 181.3K | 100.03ms | 140.45ms | 155.33ms | 163.00ms |  26.04µs |  4.24µs | 377.8 MB<sup>†</sup> | ±1.5% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  96.6K | 193.3K | 101.23ms | 114.58ms | 119.81ms | 124.42ms |  21.08µs |  2.03µs | 233.9 MB<sup>†</sup> | ±1.3% |
| **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              | 139.5K | 418.4K |  66.28ms |  96.73ms | 114.80ms | 121.81ms |  15.95µs |  2.44µs |             392.6 MB | ±0.9% |
|                                                                                                                                    | ioredis                  |  59.4K | 178.2K | 167.32ms | 191.14ms | 195.19ms | 197.60ms |  32.45µs |  4.35µs |             479.0 MB | ±1.5% |
|                                                                                                                                    | iovalkey                 |  58.5K | 175.6K | 168.64ms | 192.02ms | 196.39ms | 198.54ms |  31.14µs |  4.61µs |             495.7 MB | ±1.3% |
|                                                                                                                                    | node-redis               | 107.8K | 323.5K |  89.09ms | 101.16ms | 104.43ms | 106.34ms |  15.09µs |  3.35µs |             330.1 MB | ±1.3% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  54.8K | 164.4K | 170.22ms | 209.88ms | 221.70ms | 224.57ms |  38.61µs |  6.18µs | 392.2 MB<sup>†</sup> | ±2.0% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  54.8K | 164.5K | 175.82ms | 206.03ms | 211.25ms | 215.09ms |  35.23µs |  2.92µs | 205.8 MB<sup>†</sup> | ±1.6% |
| **List 변경**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup><br/><sub>1 KB</sub> | **solidis**              | 109.2K | 545.8K |  84.41ms | 117.64ms | 152.66ms | 163.60ms |  21.59µs |  3.11µs |             417.4 MB | ±1.9% |
|                                                                                                                                    | ioredis                  |  40.6K | 202.8K | 245.86ms | 264.10ms | 274.65ms | 277.34ms |  55.64µs |  8.90µs |             434.6 MB | ±3.6% |
|                                                                                                                                    | iovalkey                 |  42.5K | 212.6K | 234.84ms | 266.72ms | 269.97ms | 298.16ms |  56.50µs |  8.37µs |             524.8 MB | ±2.3% |
|                                                                                                                                    | node-redis               |  90.9K | 454.3K | 106.70ms | 131.70ms | 144.48ms | 146.92ms |  19.83µs |  2.35µs |             362.4 MB | ±2.5% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  49.3K | 246.6K | 199.23ms | 220.93ms | 226.34ms | 231.28ms |  43.29µs |  6.92µs | 339.7 MB<sup>†</sup> | ±1.0% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  58.3K | 291.5K | 167.89ms | 189.70ms | 197.26ms | 200.47ms |  35.49µs |  2.64µs | 107.3 MB<sup>†</sup> | ±1.1% |
| **Get**<br/><sup><kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                                          | **solidis**              | 349.1K | 349.1K |  26.29ms |  38.46ms |  43.11ms |  47.54ms |   6.48µs |  0.84µs |             120.6 MB | ±1.8% |
|                                                                                                                                    | ioredis                  | 198.9K | 198.9K |  45.80ms |  74.08ms |  84.56ms |  87.51ms |   9.63µs |  1.51µs |             242.7 MB | ±2.5% |
|                                                                                                                                    | iovalkey                 | 194.9K | 194.9K |  46.63ms |  78.77ms |  89.55ms |  99.36ms |  10.12µs |  1.70µs |             294.0 MB | ±2.6% |
|                                                                                                                                    | node-redis               | 331.9K | 331.9K |  27.86ms |  41.35ms |  45.10ms |  48.94ms |   7.28µs |  0.88µs |              91.9 MB | ±5.7% |
|                                                                                                                                    | valkey-glide             | 112.3K | 112.3K |  80.98ms | 150.33ms | 181.25ms | 212.64ms |  19.22µs |  1.22µs |  77.5 MB<sup>†</sup> | ±3.9% |
|                                                                                                                                    | speedkey                 | 183.3K | 183.3K |  50.90ms |  67.07ms |  78.32ms |  86.58ms |  15.68µs |  1.17µs |  51.8 MB<sup>†</sup> | ±3.3% |

<sub><sup>†</sup> 클라이언트가 네이티브 코드에서 쓰는 메모리는 포함하지 않습니다.</sub>

</details>

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Gear.png?raw=true" alt="Gear" width="25" height="25" /> 환경과 설정

<details>
<summary>환경과 설정 펼치기</summary>

| 항목                 | 값                                                                                                 |
| :------------------- | :------------------------------------------------------------------------------------------------- |
| CPU                  | 12th Gen Intel(R) Core(TM) i9-12900K (10 threads)                                                  |
| 메모리               | 9.7 GB                                                                                             |
| 운영체제             | linux x64 (5.15.133.1-microsoft-standard-WSL2)                                                     |
| Node.js              | v22.23.0                                                                                           |
| 서버                 | Redis 8.10.2                                                                                       |
| 클라이언트           | solidis 0.5.0, ioredis 6.0.0, iovalkey 0.4.0, node-redis 6.3.0, valkey-glide 2.5.3, speedkey 0.4.2 |
| 모드                 | `autopipeline`                                                                                     |
| 페이로드 크기        | 1 KB                                                                                               |
| 샘플당 작업 수       | 100,000                                                                                            |
| 워밍업 작업 수       | 1,000                                                                                              |
| 클라이언트당 연결 수 | 1                                                                                                  |
| 연결당 동시 실행     | 10,000                                                                                             |
| 측정 횟수            | 5                                                                                                  |
| 쿨다운               | 300ms                                                                                              |
| 날짜                 | 2026-10-05 02:30:21                                                                                |

</details>

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Open%20Book.png?raw=true" alt="Open Book" width="25" height="25" /> 측정 방법론

- 샘플마다 **별도 워커 스레드**에서 실행하므로 GC와 JIT 상태가 다음 샘플로 이어지지 않습니다.
- 샘플마다 라이브러리 순서를 **바꾸고**, 매번 서버를 **비우고 안정화**한 뒤 측정합니다.
- 모든 라이브러리가 같은 **결정론적 바이너리 페이로드**를 쓰고, 측정이 끝나면 모든 응답과 Pub/Sub 메시지를 검사합니다.
- 트랜잭션과 트랜잭션 혼합은 작업마다 배치 하나로 보냅니다(`batch` 모드). Pub/Sub은 한 번에 최대 4MB의 메시지를 발행하고 모두 도착할 때까지 기다립니다.
- 처리량은 반복 측정의 **중앙값**이고, 편차는 σ / 중앙값입니다.
- 지연 시간은 설정한 동시 실행 수에서 **작업마다** 재고, 모든 반복을 합쳐 계산합니다.
- 작업당 CPU는 측정 구간의 **프로세스 CPU 시간**(user + system)을 작업 수로 나눈 값으로, GC와 네이티브 스레드를 포함합니다. 작업당 GC는 GC 일시정지 시간을 같은 방식으로 나눈 값입니다.
- 메모리는 측정 구간 동안 워커의 힙과 `ArrayBuffer` 메모리(모든 `Buffer` 포함)가 가장 많이 늘어난 양이며, 20ms마다 잽니다. 네이티브 코드가 쓰는 메모리는 포함하지 않습니다. 실제 애플리케이션처럼 응답은 검사할 때까지 보관합니다.
- 모든 클라이언트는 **타임아웃, 레디 체크, 재연결을 끄고** 파이프라이닝 제한 없이 실행합니다. ioredis와 iovalkey는 오토 파이프라이닝을 쓰고, Valkey GLIDE와 speedkey는 RESP2에서 응답을 바이트로 디코딩합니다.
- 같은 방식으로 실행할 수 없었던 결과에는 **번호를 붙이고** 표 아래에 이유를 적습니다.
- 비교 대상: npm 주간 다운로드가 1,000회 이상이고, 컴파일 없이 설치되며, 바이너리 값을 그대로 다루는 Node.js TCP 클라이언트 전부입니다. 제외: redis-fast-driver(네이티브 빌드 필요), tedis(값을 문자열로 반환), @upstash/redis 같은 HTTP 클라이언트, 포크와 래퍼. Valkey GLIDE는 Windows 빌드가 없습니다.

</div>

## 기능

<table>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" /> 성능

- `setImmediate`로 파이프라인 자동 병합
- 선형 시간 증분 RESP 파서
- bulk 응답은 복사 없이 뷰로 반환
- 파이프라인은 만들자마자 쓰고, Node가 `writev`로 묶음

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Electric%20Plug.png?raw=true" alt="Electric Plug" width="25" height="25" /> 프로토콜

- RESP2, RESP3 지원 (Redis와 Valkey가 보내지 않는 스트리밍 응답 제외)
- RESP3 응답 타입 15가지 전부 (Map, Set, Push, Attribute, BigNumber, ...)
- RESP3 push가 커맨드 응답을 가로채지 않음
- 2^53을 넘는 정수는 `bigint`로: 원시 응답은 자동, 커맨드는 `{ bigint: true }`
- 바이너리 세이프: `Buffer` 값 쓰기, `{ buffer: true }`로 바이트 그대로 읽기

</td>
</tr>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Shield.png?raw=true" alt="Shield" width="25" height="25" /> 안정성

- 지터를 넣은 지수 백오프로 자동 재연결
- 핸드셰이크(AUTH, SELECT)가 끝난 뒤 커맨드 전송
- AUTH, 프로토콜, SELECT, 구독 자동 복구
- 재연결로 WATCH나 MULTI가 풀린 트랜잭션은 버림
- 파이프라인이나 `send()` 단위 타임아웃, 블로킹 커맨드는 별도 기한
- 서버 로딩이 끝날 때까지 기다리는 레디 체크
- 장애가 나면 처리 중인 요청을 확실하게 실패 처리

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Locked.png?raw=true" alt="Locked" width="25" height="25" /> 보안

- TLS (`rediss://` 또는 `tls` 옵션)
- ACL 사용자 이름과 비밀번호
- 디버그 항목에는 커맨드 이름만 남기고 인자는 남기지 않음
- 서버가 에러 메시지에 되돌려준 인자 텍스트는 가림
- `maxBulkStringLength` 제한과 512단계 중첩 제한

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

- `.extend()`로 필요한 커맨드만 조합 (트리 쉐이킹)
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
client.on('close', (error) => {});                 // 연결 끊김 (autoReconnect면 재연결)
client.on('reconnecting', (attempt, delay) => {}); // 재연결을 시도할 때마다
client.on('reconnected', () => {});                // 재연결 성공
client.on('end', () => {});                        // 클라이언트 종료 (quit)
client.on('error', (error) => {});                 // 치명적이지 않은 에러 (리스너가 없으면 process.emitWarning())
client.on('message', (channel, message) => {});    // Pub/Sub 메시지
client.on('pmessage', (pattern, channel, message) => {});
client.on('smessage', (channel, message) => {});   // 샤드 채널 메시지
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

| 에러 클래스              | 발생 조건                                                                          |
| :----------------------- | :--------------------------------------------------------------------------------- |
| `SolidisCommandError`    | 서버 에러(`cause`는 `RespError`), 예상과 다른 응답, 거부된 옵션                    |
| `SolidisClientError`     | 제한 시간 안에 준비되지 않음, 핸드셰이크 거부, quit, 예외를 던진 리스너            |
| `SolidisConnectionError` | 연결 실패와 타임아웃, 잘못된 포트, 연결 끊김, 재시도 소진, 연결 거부               |
| `SolidisRequesterError`  | 커맨드 타임아웃, 연결이 끊겨 보내지 못한 커맨드, 잘못되거나 거부된 `send()` 커맨드 |
| `SolidisParserError`     | 잘못된 RESP, 너무 큰 bulk string이나 줄, 512단계를 넘는 중첩                       |
| `SolidisPubSubError`     | 잘못된 Pub/Sub 이벤트, 예외를 던진 Pub/Sub·push 리스너                             |

> [!NOTE]
>
> - 선언된 타입의 인자로 생긴 에러는 모두 `SolidisError`이고, 원인은 표준 `cause`로 이어집니다.
> - 메시지에는 커맨드 이름(`[INCR] ERR ...`)만 붙고 인자는 붙지 않습니다. 따옴표 안의 텍스트가 인자에 들어 있으면 메시지와 `cause` 모두에서 `'***'`로 가리며, 스크립트의 Lua 토큰도 마찬가지입니다. 따옴표 없이 되돌려준 값(GEOADD 좌표, `redis.error_reply()` 텍스트, FUNCTION LOAD의 함수 이름)은 그대로 남습니다.
> - 4,096자보다 긴 메시지는 잘리고, 잘린 메시지에서 가린 부분이 있으면 끝까지 가립니다.
> - 인자는 선언된 타입으로만 검사합니다. JavaScript에서 배열 자리에 문자열, 객체 자리에 배열을 넘기거나 ioredis식으로 `set(key, value, 'EX', 10)`을 쓰면 다른 커맨드가 됩니다. 필드 레코드는 객체만 받습니다.
> - ESM과 CJS 빌드의 클라이언트와 커맨드는 섞어 쓸 수 있지만, 에러 클래스는 빌드마다 따로라서 `instanceof`는 같은 빌드의 에러에만 맞습니다.
> - TS.MADD, BF.MADD, BF.INSERT는 거부된 항목을 결과 안의 `RespError`로 돌려줍니다.

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

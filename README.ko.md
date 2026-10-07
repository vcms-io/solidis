<h1 align="center"><img src="./assets/solidis.png" alt="Solidis" width="50"/></h1>

<h3 align="center">
  <b>Node.js에서 가장 빠른 Redis 클라이언트.<br/>의존성 없음, 프로덕션에서 검증된 안정성.</b>
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
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Package.png?raw=true" alt="Package" width="32" height="32" /><br/><strong>384</strong><br/><sub>커맨드</sub></td>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Test%20Tube.png?raw=true" alt="Test Tube" width="32" height="32" /><br/><strong>35K+</strong><br/><sub>테스트 코드 줄 수</sub></td>
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
> **번들을 더 줄이려면** `SolidisClient`와 `.extend()`로 쓰는 커맨드만 가져오세요. 트리 셰이킹하면 **29KB 미만**입니다.

<details>
<summary>&nbsp;&nbsp;<b>트리 셰이킹 클라이언트</b></summary>

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
- `send()`로 여러 커맨드를 보낼 때는 `AUTH`와 `HELLO`를 맨 앞에 두세요. 트랜잭션 안에서는 `send()`가 거부합니다. 그 순간 서버에 RESP3 push가 남아 있으면 에러는 여전히 빠지고, `AUTH`는 타임아웃됩니다.

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

- 기한은 `commandTimeout`에 블로킹 타임아웃을 더한 값이고, 무한 대기면 기한이 없습니다.
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
| 그 밖의 인자              | PUBLISH, SPUBLISH(메시지) · BF.LOADCHUNK, CF.LOADCHUNK(청크) · AUTH, HELLO(자격 증명) · `send()`(모든 인자)                                                    |
| `{ buffer: true }`로 읽기 | GET, GETDEL, GETEX, GETRANGE, MGET, HGET, HMGET, HGETALL, HVALS, LINDEX, LRANGE, LPOP, RPOP, LMOVE, BLMOVE, RPOPLPUSH, BRPOPLPUSH, BLPOP, BRPOP, LMPOP, BLMPOP |

- `Buffer` 응답은 수신한 청크(최대 64KB)의 뷰입니다. 오래 보관하려면 `Buffer.from()`으로 복사하세요.
- `send()`는 커맨드 배열을 복사하지만 그 안의 `Buffer`는 복사하지 않습니다. 커맨드가 끝날 때까지 `Buffer`를 바꾸지 마세요.
- 필드 이름(HGETALL, HSCAN, 스트림)과 RESP3 맵 키는 `send()`에서도 UTF-8로 디코딩합니다. UTF-8이 아닌 이름은 서로 겹칠 수 있으니 바이너리 데이터는 값에 담으세요.
- 스트림, 셋, 정렬 셋 읽기와 HSCAN, HRANDFIELD, GETSET, SORT, SORT_RO, LCS는 값을 UTF-8 문자열로 돌려줍니다. 바이너리 값은 `send()`로 읽으세요.
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
- `justid`를 준 `xautoclaim()`은 ID를 `fields`가 빈 엔트리로 돌려주고, `justid`를 준 `xclaim()`은 ID만 돌려줍니다.

</details>

<br/>

<div id="benchmark">

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Bar%20Chart.png?raw=true" alt="Bar Chart" width="25" height="25" /> 벤치마크

<div align="center">

# <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" /> Solidis vs ioredis, iovalkey, node-redis, valkey-glide, speedkey

<small>측정일 2026-10-05 15:52:42 UTC · linux x64 · Node.js v22.23.0 · Redis 8.10.2</small>

### 벤치마크 **19**개 중 **19**개에서 가장 빠름 · 처리량은 2위 클라이언트 대비 평균 **1.5배** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Rocket.png?raw=true" alt="Rocket" width="25" height="25" />

### 순위

|                                                                                                                                                                                        | 클라이언트   | 버전  |    1위 횟수 |    처리량 | 작업당 CPU |       최대 메모리 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------- | :---- | ----------: | --------: | ---------: | ----------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **solidis**  | 0.5.0 | **19** / 19 | **1.00x** |  **1.00x** |         **1.00x** |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | node-redis   | 6.3.0 |      0 / 19 |     0.67x |      1.11x |             0.92x |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | speedkey     | 0.4.2 |      0 / 19 |     0.47x |      1.98x | 0.46x<sup>†</sup> |
|                                                                                                                                                                                     4. | iovalkey     | 0.4.0 |      0 / 19 |     0.41x |      2.17x |             1.40x |
|                                                                                                                                                                                     5. | ioredis      | 6.0.0 |      0 / 19 |     0.40x |      2.22x |             1.30x |
|                                                                                                                                                                                     6. | valkey-glide | 2.5.3 |      0 / 19 |     0.38x |      2.50x | 1.01x<sup>†</sup> |

<sub>처리량, 작업당 CPU, 최대 메모리는 모든 벤치마크의 기하평균이며, `solidis`(1.00x) 대비 값입니다. 처리량은 높을수록, CPU와 메모리는 낮을수록 좋습니다.</sub>

<sub><sup>†</sup> 클라이언트가 네이티브 코드에서 쓰는 메모리는 포함하지 않습니다.</sub>

### 초당 작업 수

_작업 100,000회 × 동시 실행 10,000 · 1 KB 페이로드 · 클라이언트마다 10회 측정_

|                                                                                                                                                                                        | 벤치마크                                                                                                       | **solidis** |            ioredis |           iovalkey | node-redis |       valkey-glide |           speedkey |                                                                                                                                                                          배율                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------- | ----------: | -----------------: | -----------------: | ---------: | -----------------: | -----------------: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **트랜잭션 혼합**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup>                                                 |  **134.5K** |              27.4K |              29.9K |      60.7K |  41.1K<sup>1</sup> |              45.2K | **2.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | **트랜잭션**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup>                                    |  **167.6K** |              34.8K |              38.2K |      77.8K |  66.2K<sup>1</sup> |              54.7K | **2.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup>                                               |  **296.5K** |             142.9K |             156.2K |     154.7K |  43.1K<sup>2</sup> | 129.6K<sup>2</sup> | **1.9x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
|                                                                                                                                                                                     4. | **Set**<br/><sup><kbd>SET</kbd></sup>                                                                          |  **349.2K** |             144.7K |             148.2K |     217.0K |             114.3K |             167.7K | **1.6x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
|                                                                                                                                                                                     5. | **Set 조회**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup>                           |  **159.1K** |              59.5K |              59.4K |     102.9K |  69.2K<sup>3</sup> |  79.2K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     6. | **파이프라인 혼합**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup>                               |  **164.8K** |              71.0K |              72.7K |     110.5K |  70.4K<sup>3</sup> |  82.6K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     7. | **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup>                                      |  **172.5K** |              73.1K |              73.2K |     115.7K |  79.8K<sup>3</sup> |  89.1K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     8. | **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup>                                |  **142.4K** |              58.9K |              62.1K |      96.8K |  59.8K<sup>3</sup> |  69.6K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     9. | **Set 변경**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup>                               |  **149.2K** |              52.9K |              54.8K |     101.6K |  68.1K<sup>3</sup> |  89.6K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    10. | **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup>                                                   |  **148.4K** |              62.4K |              68.6K |     102.3K |  62.5K<sup>3</sup> |  72.2K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    11. | **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup>                                                     |  **265.7K** |             124.2K |             129.7K |     187.6K | 105.7K<sup>3</sup> | 134.1K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    12. | **비트랜잭션**<br/><sup><kbd>SET PX</kbd> <kbd>GET</kbd></sup>                                                 |  **195.1K** |              84.6K |              85.4K |     137.8K |  83.3K<sup>3</sup> | 101.6K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    13. | **Hash 변경**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup>                                 |  **125.3K** |              53.6K |              57.4K |      88.6K |  51.3K<sup>3</sup> |  58.8K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    14. | **List 범위**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup>                               |  **129.0K** |              54.6K |              56.3K |      92.3K |  57.7K<sup>3</sup> |  71.9K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    15. | **Hash 왕복**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup>                                |  **144.4K** |              66.4K |              69.0K |     104.0K |  61.1K<sup>3</sup> |  66.9K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    16. | **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup>                                    |  **140.8K** |              58.8K |              59.3K |     106.6K |  54.0K<sup>3</sup> |  55.5K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    17. | **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIG GET</kbd></sup>                                         |  **224.1K** | 111.8K<sup>4</sup> | 115.3K<sup>4</sup> |     176.2K |  91.0K<sup>3</sup> |  97.0K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    18. | **List 변경**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup> |  **107.3K** |              40.1K |              40.7K |      88.2K |  48.6K<sup>3</sup> |  57.0K<sup>3</sup> |                                                                           **1.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    19. | **Get**<br/><sup><kbd>GET</kbd></sup>                                                                          |  **350.1K** |             192.0K |             189.2K |     322.8K |             112.0K |             177.6K |                                                                           **1.1x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |

<sub>반복 측정의 초당 작업 수 중앙값이며, 벤치마크마다 가장 빠른 클라이언트를 굵게 표시합니다. 배율 = `solidis` ÷ 다른 클라이언트 중 가장 빠른 값.</sub>

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
| **트랜잭션 혼합**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                 | **solidis**              | 134.5K | 807.2K |  71.01ms | 103.67ms | 127.03ms | 139.02ms |  17.04µs |  2.10µs |             354.5 MB | ±3.3% |
|                                                                                                                                    | ioredis                  |  27.4K | 164.2K | 354.91ms | 393.55ms | 420.46ms | 435.65ms |  60.52µs |  6.51µs |             675.6 MB | ±1.9% |
|                                                                                                                                    | iovalkey                 |  29.9K | 179.2K | 330.10ms | 369.66ms | 400.34ms | 419.90ms |  57.45µs |  7.15µs |             711.5 MB | ±2.1% |
|                                                                                                                                    | node-redis               |  60.7K | 364.2K | 161.21ms | 194.84ms | 202.59ms | 209.04ms |  30.87µs |  4.14µs |             491.5 MB | ±3.2% |
|                                                                                                                                    | valkey-glide<sup>1</sup> |  41.1K | 246.6K | 240.87ms | 266.52ms | 284.39ms | 290.36ms |  54.74µs |  7.90µs | 357.4 MB<sup>†</sup> | ±3.1% |
|                                                                                                                                    | speedkey                 |  45.2K | 271.1K | 214.38ms | 256.05ms | 295.61ms | 311.12ms |  44.69µs |  3.49µs | 216.4 MB<sup>†</sup> | ±3.1% |
| **트랜잭션**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              | 167.6K | 837.8K |  54.50ms |  98.86ms | 115.78ms | 125.05ms |  12.48µs |  1.66µs |             276.9 MB | ±1.7% |
|                                                                                                                                    | ioredis                  |  34.8K | 174.0K | 282.19ms | 306.98ms | 318.97ms | 325.83ms |  46.63µs |  5.39µs |             622.0 MB | ±1.8% |
|                                                                                                                                    | iovalkey                 |  38.2K | 190.8K | 255.41ms | 278.59ms | 291.74ms | 303.42ms |  44.92µs |  5.86µs |             650.3 MB | ±1.3% |
|                                                                                                                                    | node-redis               |  77.8K | 389.2K | 122.50ms | 142.11ms | 148.71ms | 152.53ms |  25.28µs |  3.60µs |             534.7 MB | ±2.4% |
|                                                                                                                                    | valkey-glide<sup>1</sup> |  66.2K | 330.9K | 139.83ms | 169.32ms | 179.47ms | 186.45ms |  33.13µs |  5.38µs | 371.4 MB<sup>†</sup> | ±1.6% |
|                                                                                                                                    | speedkey                 |  54.7K | 273.7K | 178.66ms | 211.10ms | 223.31ms | 230.86ms |  36.56µs |  3.05µs | 204.5 MB<sup>†</sup> | ±1.6% |
| **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup><br/><sub>1 KB</sub>                                               | **solidis**              | 296.5K | 296.5K |   7.88ms |  17.42ms |  25.33ms |  29.34ms |   6.82µs |  0.85µs |             146.7 MB | ±3.2% |
|                                                                                                                                    | ioredis                  | 142.9K | 142.9K |  17.71ms |  29.22ms |  35.81ms |  38.85ms |  13.25µs |  1.72µs |             221.2 MB | ±1.8% |
|                                                                                                                                    | iovalkey                 | 156.2K | 156.2K |  15.65ms |  29.60ms |  34.43ms |  37.92ms |  12.83µs |  1.81µs |             234.1 MB | ±2.1% |
|                                                                                                                                    | node-redis               | 154.7K | 154.7K |  17.20ms |  25.10ms |  30.65ms |  33.24ms |   8.73µs |  2.39µs |             179.3 MB | ±4.0% |
|                                                                                                                                    | valkey-glide<sup>2</sup> |  43.1K |  43.1K |  52.71ms |  81.37ms |  85.41ms |  89.92ms |  57.37µs |  2.35µs | 125.4 MB<sup>†</sup> | ±0.7% |
|                                                                                                                                    | speedkey<sup>2</sup>     | 129.6K | 129.6K |  16.04ms |  23.31ms |  30.89ms |  34.36ms |  19.01µs |  0.99µs |  59.0 MB<sup>†</sup> | ±2.2% |
| **Set**<br/><sup><kbd>SET</kbd></sup><br/><sub>1 KB</sub>                                                                          | **solidis**              | 349.2K | 349.2K |  25.70ms |  47.61ms |  53.35ms |  61.28ms |   6.76µs |  1.05µs |             184.5 MB | ±3.0% |
|                                                                                                                                    | ioredis                  | 144.7K | 144.7K |  63.82ms |  90.81ms | 101.49ms | 110.37ms |  13.05µs |  1.89µs |             258.5 MB | ±2.1% |
|                                                                                                                                    | iovalkey                 | 148.2K | 148.2K |  60.92ms |  93.87ms | 100.52ms | 104.79ms |  13.22µs |  2.00µs |             273.7 MB | ±3.9% |
|                                                                                                                                    | node-redis               | 217.0K | 217.0K |  43.54ms |  50.53ms |  56.35ms |  68.67ms |   8.09µs |  1.65µs |             178.7 MB | ±3.2% |
|                                                                                                                                    | valkey-glide             | 114.3K | 114.3K |  82.05ms |  95.76ms | 102.24ms | 106.77ms |  18.40µs |  2.02µs | 215.6 MB<sup>†</sup> | ±2.7% |
|                                                                                                                                    | speedkey                 | 167.7K | 167.7K |  54.28ms |  77.77ms |  89.33ms | 102.12ms |  15.11µs |  1.06µs | 157.5 MB<sup>†</sup> | ±4.6% |
| **Set 조회**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup><br/><sub>1 KB</sub>                           | **solidis**              | 159.1K | 477.3K |  58.66ms |  89.38ms | 108.07ms | 116.20ms |  14.19µs |  2.15µs |             329.2 MB | ±2.3% |
|                                                                                                                                    | ioredis                  |  59.5K | 178.4K | 165.10ms | 199.29ms | 208.90ms | 212.38ms |  35.94µs |  4.92µs |             392.6 MB | ±2.7% |
|                                                                                                                                    | iovalkey                 |  59.4K | 178.1K | 165.69ms | 198.42ms | 203.06ms | 208.60ms |  36.02µs |  4.95µs |             400.4 MB | ±1.5% |
|                                                                                                                                    | node-redis               | 102.9K | 308.6K |  94.27ms | 107.39ms | 112.13ms | 120.28ms |  15.24µs |  3.19µs |             274.9 MB | ±2.1% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  69.2K | 207.6K | 139.22ms | 157.53ms | 163.72ms | 173.95ms |  31.16µs |  5.04µs | 320.0 MB<sup>†</sup> | ±2.0% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  79.2K | 237.7K | 122.00ms | 136.64ms | 147.56ms | 156.95ms |  26.40µs |  2.11µs |  78.8 MB<sup>†</sup> | ±2.0% |
| **파이프라인 혼합**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              | 164.8K | 494.5K |  56.70ms |  89.85ms | 104.52ms | 112.51ms |  13.95µs |  2.15µs |             336.8 MB | ±2.8% |
|                                                                                                                                    | ioredis                  |  71.0K | 213.1K | 137.37ms | 163.22ms | 169.75ms | 173.36ms |  29.10µs |  4.29µs |             468.7 MB | ±2.3% |
|                                                                                                                                    | iovalkey                 |  72.7K | 218.1K | 131.90ms | 160.92ms | 166.64ms | 169.68ms |  27.58µs |  4.42µs |             521.0 MB | ±2.4% |
|                                                                                                                                    | node-redis               | 110.5K | 331.4K |  87.15ms |  99.28ms | 107.09ms | 114.59ms |  14.24µs |  3.13µs |             281.0 MB | ±3.1% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  70.4K | 211.3K | 133.03ms | 161.34ms | 173.25ms | 190.62ms |  29.83µs |  5.10µs | 339.7 MB<sup>†</sup> | ±2.7% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  82.6K | 247.9K | 118.29ms | 132.27ms | 135.91ms | 142.11ms |  25.72µs |  2.13µs |  77.5 MB<sup>†</sup> | ±2.5% |
| **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup><br/><sub>1 KB</sub>                                      | **solidis**              | 172.5K | 517.4K |  52.75ms |  85.45ms |  95.27ms | 101.48ms |  12.94µs |  2.10µs |             308.4 MB | ±3.1% |
|                                                                                                                                    | ioredis                  |  73.1K | 219.2K | 132.19ms | 157.81ms | 161.68ms | 170.01ms |  26.08µs |  4.09µs |             463.2 MB | ±2.2% |
|                                                                                                                                    | iovalkey                 |  73.2K | 219.6K | 133.22ms | 155.19ms | 159.40ms | 170.40ms |  26.20µs |  4.31µs |             495.2 MB | ±2.0% |
|                                                                                                                                    | node-redis               | 115.7K | 347.2K |  81.99ms |  93.48ms |  99.90ms | 106.39ms |  13.46µs |  3.25µs |             234.5 MB | ±1.8% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  79.8K | 239.3K | 120.19ms | 136.70ms | 143.91ms | 151.73ms |  25.93µs |  4.95µs | 411.0 MB<sup>†</sup> | ±2.1% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  89.1K | 267.2K | 109.64ms | 121.66ms | 126.95ms | 129.88ms |  23.38µs |  1.87µs | 127.0 MB<sup>†</sup> | ±1.9% |
| **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup><br/><sub>1 KB</sub>                                | **solidis**              | 142.4K | 427.1K |  65.96ms |  93.88ms | 109.31ms | 115.66ms |  16.25µs |  2.39µs |             405.4 MB | ±2.3% |
|                                                                                                                                    | ioredis                  |  58.9K | 176.6K | 163.53ms | 192.01ms | 207.45ms | 212.45ms |  36.49µs |  4.50µs |             377.0 MB | ±2.6% |
|                                                                                                                                    | iovalkey                 |  62.1K | 186.3K | 157.09ms | 187.48ms | 204.00ms | 207.22ms |  34.13µs |  4.47µs |             411.6 MB | ±3.3% |
|                                                                                                                                    | node-redis               |  96.8K | 290.3K |  99.48ms | 118.14ms | 124.60ms | 129.96ms |  16.44µs |  3.34µs |             331.1 MB | ±2.0% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  59.8K | 179.4K | 160.94ms | 185.08ms | 190.43ms | 197.68ms |  35.18µs |  5.89µs | 350.5 MB<sup>†</sup> | ±1.7% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  69.6K | 208.7K | 139.78ms | 164.20ms | 169.73ms | 179.20ms |  28.95µs |  2.17µs | 209.9 MB<sup>†</sup> | ±1.2% |
| **Set 변경**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              | 149.2K | 447.7K |  59.07ms | 109.49ms | 127.88ms | 134.32ms |  16.02µs |  2.39µs |             262.5 MB | ±3.4% |
|                                                                                                                                    | ioredis                  |  52.9K | 158.7K | 183.47ms | 204.59ms | 217.81ms | 222.01ms |  37.32µs |  5.01µs |             187.9 MB | ±5.5% |
|                                                                                                                                    | iovalkey                 |  54.8K | 164.3K | 175.85ms | 198.80ms | 207.48ms | 209.83ms |  37.76µs |  4.85µs |             307.4 MB | ±7.6% |
|                                                                                                                                    | node-redis               | 101.6K | 304.9K |  95.75ms | 107.91ms | 113.82ms | 120.47ms |  14.77µs |  3.17µs |             230.2 MB | ±3.2% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  68.1K | 204.4K | 143.61ms | 160.99ms | 167.06ms | 175.10ms |  30.53µs |  5.18µs | 342.8 MB<sup>†</sup> | ±1.8% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  89.6K | 268.8K | 109.25ms | 120.56ms | 125.93ms | 131.43ms |  23.52µs |  1.80µs | 117.4 MB<sup>†</sup> | ±2.2% |
| **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup><br/><sub>1 KB</sub>                                                   | **solidis**              | 148.4K | 296.7K |  65.35ms |  85.77ms | 102.86ms | 111.47ms |  15.58µs |  1.85µs |             355.7 MB | ±3.2% |
|                                                                                                                                    | ioredis                  |  62.4K | 124.9K | 159.02ms | 178.00ms | 187.55ms | 189.48ms |  38.52µs |  4.22µs |             399.9 MB | ±2.6% |
|                                                                                                                                    | iovalkey                 |  68.6K | 137.1K | 144.45ms | 170.90ms | 179.89ms | 195.27ms |  31.77µs |  3.87µs |             445.3 MB | ±2.0% |
|                                                                                                                                    | node-redis               | 102.3K | 204.6K |  94.45ms | 113.72ms | 151.61ms | 174.21ms |  16.68µs |  2.88µs |             307.2 MB | ±5.9% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  62.5K | 125.0K | 156.23ms | 176.67ms | 181.75ms | 191.26ms |  36.39µs |  4.86µs | 280.7 MB<sup>†</sup> | ±2.7% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  72.2K | 144.4K | 133.65ms | 159.67ms | 167.13ms | 172.51ms |  28.04µs |  2.18µs | 169.9 MB<sup>†</sup> | ±1.8% |
| **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup><br/><sub>1 KB</sub>                                                     | **solidis**              | 265.7K | 531.3K |  33.75ms |  53.21ms |  60.98ms |  72.59ms |   9.27µs |  1.52µs |             253.6 MB | ±2.3% |
|                                                                                                                                    | ioredis                  | 124.2K | 248.3K |  73.75ms | 113.98ms | 122.37ms | 128.37ms |  16.98µs |  2.97µs |             350.1 MB | ±3.5% |
|                                                                                                                                    | iovalkey                 | 129.7K | 259.4K |  71.02ms | 106.11ms | 115.05ms | 123.70ms |  16.75µs |  3.02µs |             329.2 MB | ±4.0% |
|                                                                                                                                    | node-redis               | 187.6K | 375.3K |  50.13ms |  62.31ms |  68.19ms |  73.07ms |   9.31µs |  2.43µs |             224.5 MB | ±2.7% |
|                                                                                                                                    | valkey-glide<sup>3</sup> | 105.7K | 211.5K |  85.65ms | 123.94ms | 141.14ms | 156.06ms |  22.11µs |  3.75µs | 371.6 MB<sup>†</sup> | ±3.7% |
|                                                                                                                                    | speedkey<sup>3</sup>     | 134.1K | 268.2K |  72.36ms |  81.70ms |  86.22ms |  91.20ms |  16.39µs |  1.55µs | 253.1 MB<sup>†</sup> | ±1.2% |
| **비트랜잭션**<br/><sup><kbd>SET PX</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                 | **solidis**              | 195.1K | 390.2K |  47.09ms |  76.79ms |  91.10ms | 100.14ms |  11.58µs |  1.64µs |             272.6 MB | ±2.1% |
|                                                                                                                                    | ioredis                  |  84.6K | 169.2K | 115.28ms | 139.93ms | 143.78ms | 151.76ms |  22.52µs |  3.14µs |             394.5 MB | ±1.5% |
|                                                                                                                                    | iovalkey                 |  85.4K | 170.7K | 114.26ms | 133.99ms | 137.97ms | 139.74ms |  22.60µs |  3.29µs |             416.8 MB | ±1.8% |
|                                                                                                                                    | node-redis               | 137.8K | 275.6K |  69.63ms |  80.19ms |  85.10ms |  89.83ms |  11.78µs |  2.48µs |             229.4 MB | ±3.1% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  83.3K | 166.5K | 111.95ms | 131.98ms | 141.72ms | 151.19ms |  26.36µs |  4.22µs | 312.4 MB<sup>†</sup> | ±1.6% |
|                                                                                                                                    | speedkey<sup>3</sup>     | 101.6K | 203.2K |  96.47ms | 108.44ms | 114.75ms | 118.98ms |  21.04µs |  1.86µs | 192.9 MB<sup>†</sup> | ±2.7% |
| **Hash 변경**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup><br/><sub>1 KB</sub>                                 | **solidis**              | 125.3K | 375.9K |  72.10ms | 104.19ms | 116.55ms | 125.46ms |  18.58µs |  2.35µs |             401.5 MB | ±1.6% |
|                                                                                                                                    | ioredis                  |  53.6K | 160.7K | 184.97ms | 213.79ms | 231.28ms | 239.09ms |  46.19µs |  5.24µs |             443.1 MB | ±1.4% |
|                                                                                                                                    | iovalkey                 |  57.4K | 172.1K | 173.57ms | 191.80ms | 198.37ms | 203.73ms |  44.60µs |  5.45µs |             440.4 MB | ±1.4% |
|                                                                                                                                    | node-redis               |  88.6K | 265.7K | 108.94ms | 127.09ms | 135.08ms | 144.21ms |  18.75µs |  3.42µs |             321.1 MB | ±3.7% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  51.3K | 153.8K | 190.19ms | 214.66ms | 220.16ms | 229.51ms |  42.00µs |  6.64µs | 336.7 MB<sup>†</sup> | ±2.6% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  58.8K | 176.3K | 163.64ms | 193.34ms | 224.32ms | 272.11ms |  33.75µs |  2.55µs | 191.0 MB<sup>†</sup> | ±3.8% |
| **List 범위**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              | 129.0K | 386.9K |  70.95ms | 105.17ms | 111.57ms | 117.66ms |  18.22µs |  2.40µs |             406.7 MB | ±2.1% |
|                                                                                                                                    | ioredis                  |  54.6K | 163.9K | 181.76ms | 211.39ms | 231.15ms | 239.05ms |  45.43µs |  5.06µs |             446.9 MB | ±3.0% |
|                                                                                                                                    | iovalkey                 |  56.3K | 169.0K | 178.10ms | 195.61ms | 202.96ms | 209.65ms |  43.73µs |  5.30µs |             421.7 MB | ±1.4% |
|                                                                                                                                    | node-redis               |  92.3K | 277.0K | 104.85ms | 128.49ms | 135.34ms | 143.18ms |  18.25µs |  3.31µs |             317.4 MB | ±3.5% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  57.7K | 173.1K | 166.52ms | 191.45ms | 204.21ms | 219.41ms |  38.77µs |  5.57µs | 301.5 MB<sup>†</sup> | ±2.0% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  71.9K | 215.7K | 134.82ms | 161.35ms | 175.46ms | 210.47ms |  29.05µs |  2.32µs | 179.3 MB<sup>†</sup> | ±2.4% |
| **Hash 왕복**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup><br/><sub>1 KB</sub>                                | **solidis**              | 144.4K | 433.3K |  63.82ms |  89.03ms | 104.16ms | 110.40ms |  16.63µs |  2.20µs |             373.9 MB | ±1.7% |
|                                                                                                                                    | ioredis                  |  66.4K | 199.1K | 144.32ms | 176.34ms | 180.65ms | 184.65ms |  31.88µs |  4.26µs |             502.2 MB | ±2.3% |
|                                                                                                                                    | iovalkey                 |  69.0K | 206.9K | 139.04ms | 165.19ms | 172.18ms | 179.52ms |  33.04µs |  4.62µs |             515.2 MB | ±2.4% |
|                                                                                                                                    | node-redis               | 104.0K | 312.1K |  92.23ms | 106.01ms | 110.45ms | 113.07ms |  16.33µs |  3.23µs |             339.7 MB | ±2.6% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  61.1K | 183.4K | 156.83ms | 185.36ms | 191.94ms | 196.77ms |  34.83µs |  5.55µs | 325.1 MB<sup>†</sup> | ±2.9% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  66.9K | 200.6K | 145.07ms | 168.00ms | 178.83ms | 189.75ms |  31.57µs |  2.49µs | 167.0 MB<sup>†</sup> | ±2.1% |
| **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              | 140.8K | 422.4K |  65.05ms | 101.30ms | 114.95ms | 119.90ms |  15.94µs |  2.48µs |             392.2 MB | ±2.3% |
|                                                                                                                                    | ioredis                  |  58.8K | 176.5K | 167.84ms | 192.04ms | 199.59ms | 210.77ms |  32.47µs |  4.30µs |             462.3 MB | ±2.3% |
|                                                                                                                                    | iovalkey                 |  59.3K | 177.9K | 164.58ms | 192.50ms | 200.96ms | 205.78ms |  30.75µs |  4.48µs |             499.8 MB | ±1.2% |
|                                                                                                                                    | node-redis               | 106.6K | 319.9K |  90.20ms | 101.36ms | 108.10ms | 116.93ms |  15.21µs |  3.39µs |             330.5 MB | ±2.1% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  54.0K | 162.0K | 172.55ms | 211.16ms | 222.84ms | 239.99ms |  38.90µs |  6.24µs | 392.9 MB<sup>†</sup> | ±1.3% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  55.5K | 166.4K | 173.53ms | 204.52ms | 214.02ms | 218.42ms |  34.92µs |  2.88µs | 205.7 MB<sup>†</sup> | ±1.1% |
| **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIG GET</kbd></sup><br/><sub>1 KB</sub>                                         | **solidis**              | 224.1K | 448.2K |  39.09ms |  71.97ms |  82.95ms |  95.84ms |  10.59µs |  1.66µs |             287.4 MB | ±2.3% |
|                                                                                                                                    | ioredis<sup>4</sup>      | 111.8K | 223.7K |  82.88ms | 124.81ms | 133.86ms | 138.06ms |  17.14µs |  2.35µs |             275.8 MB | ±1.8% |
|                                                                                                                                    | iovalkey<sup>4</sup>     | 115.3K | 230.6K |  78.61ms | 117.28ms | 122.82ms | 127.81ms |  17.09µs |  2.48µs |             308.0 MB | ±1.9% |
|                                                                                                                                    | node-redis               | 176.2K | 352.3K |  52.97ms |  72.09ms |  81.40ms |  90.86ms |  10.44µs |  2.37µs |             243.2 MB | ±3.5% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  91.0K | 181.9K |  99.90ms | 142.04ms | 162.74ms | 169.83ms |  25.69µs |  4.23µs | 386.5 MB<sup>†</sup> | ±2.1% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  97.0K | 194.0K |  99.86ms | 112.78ms | 118.24ms | 133.20ms |  21.16µs |  2.03µs | 231.4 MB<sup>†</sup> | ±1.5% |
| **List 변경**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup><br/><sub>1 KB</sub> | **solidis**              | 107.3K | 536.7K |  86.97ms | 119.97ms | 154.37ms | 166.19ms |  22.05µs |  3.13µs |             420.1 MB | ±1.1% |
|                                                                                                                                    | ioredis                  |  40.1K | 200.7K | 248.36ms | 271.40ms | 288.72ms | 296.80ms |  56.42µs |  8.87µs |             434.1 MB | ±1.5% |
|                                                                                                                                    | iovalkey                 |  40.7K | 203.6K | 243.12ms | 260.60ms | 268.22ms | 275.42ms |  56.47µs |  8.69µs |             436.1 MB | ±1.5% |
|                                                                                                                                    | node-redis               |  88.2K | 440.8K | 108.81ms | 128.74ms | 134.71ms | 143.35ms |  20.55µs |  2.24µs |             365.1 MB | ±2.8% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  48.6K | 243.2K | 202.81ms | 225.68ms | 234.38ms | 240.85ms |  43.87µs |  7.01µs | 338.4 MB<sup>†</sup> | ±1.8% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  57.0K | 285.2K | 169.94ms | 192.97ms | 217.41ms | 261.83ms |  36.36µs |  2.69µs | 106.5 MB<sup>†</sup> | ±2.4% |
| **Get**<br/><sup><kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                                          | **solidis**              | 350.1K | 350.1K |  26.72ms |  38.34ms |  43.07ms |  48.51ms |   6.36µs |  0.84µs |             112.6 MB | ±4.5% |
|                                                                                                                                    | ioredis                  | 192.0K | 192.0K |  47.08ms |  75.40ms |  88.34ms |  92.85ms |  10.18µs |  1.60µs |             274.0 MB | ±2.6% |
|                                                                                                                                    | iovalkey                 | 189.2K | 189.2K |  47.62ms |  79.35ms |  91.36ms |  96.68ms |  10.43µs |  1.73µs |             298.2 MB | ±1.7% |
|                                                                                                                                    | node-redis               | 322.8K | 322.8K |  27.91ms |  42.98ms |  51.75ms |  68.03ms |   7.47µs |  0.96µs |              86.2 MB | ±5.7% |
|                                                                                                                                    | valkey-glide             | 112.0K | 112.0K |  80.80ms | 139.17ms | 159.95ms | 174.48ms |  19.70µs |  1.24µs |  81.0 MB<sup>†</sup> | ±2.9% |
|                                                                                                                                    | speedkey                 | 177.6K | 177.6K |  52.23ms |  68.85ms |  80.90ms |  90.14ms |  16.21µs |  1.18µs |  17.8 MB<sup>†</sup> | ±2.7% |

<sub><sup>†</sup> 클라이언트가 네이티브 코드에서 쓰는 메모리는 포함하지 않습니다.</sub>

</details>

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Gear.png?raw=true" alt="Gear" width="25" height="25" /> 환경과 설정

<details>
<summary>환경과 설정 펼치기</summary>

| 항목                 | 값                                                                                                 |
| :------------------- | :------------------------------------------------------------------------------------------------- |
| CPU                  | 12th Gen Intel(R) Core(TM) i9-12900K (스레드 10개)                                                 |
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
| 측정 횟수            | 10                                                                                                 |
| 쿨다운               | 300ms                                                                                              |
| 날짜                 | 2026-10-05 15:52:42 UTC                                                                            |

</details>

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Open%20Book.png?raw=true" alt="Open Book" width="25" height="25" /> 측정 방법론

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

</div>

## 기능

<table>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" /> 성능

- `setImmediate`로 파이프라인 자동 병합
- 선형 시간 증분 RESP 파서
- bulk 응답은 복사 없이 뷰로 반환
- 파이프라인은 만들자마자 소켓에 쓰고, Node가 `writev`로 묶음

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Electric%20Plug.png?raw=true" alt="Electric Plug" width="25" height="25" /> 프로토콜

- RESP2, RESP3 지원 (Redis와 Valkey가 보내지 않는 스트리밍 응답 제외)
- RESP3 응답 타입 15가지 전부 (Map, Set, Push, Attribute, BigNumber, ...)
- 추적 무효화 같은 push가 커맨드 응답을 가로채지 않음
- `Number.MAX_SAFE_INTEGER`를 넘는 정수는 `bigint`로: 원시 응답은 자동, INCR, INCRBY, DECR, DECRBY, HINCRBY, BITFIELD, BITFIELD_RO는 `{ bigint: true }`
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
- 커맨드 에러에서는 서버가 되돌려준 인자 텍스트를 가림
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
client.on('close', (error) => {});                 // 연결 끊김 (autoReconnect면 재연결)
client.on('reconnecting', (attempt, delay) => {}); // 재연결을 시도할 때마다
client.on('reconnected', () => {});                // 재연결 성공
client.on('end', () => {});                        // 클라이언트 종료 (quit)
client.on('error', (error) => {});                 // 치명적이지 않은 에러 (리스너가 없으면 process.emitWarning())
client.on('drain', () => {});                      // 쓰기 버퍼가 비워짐
client.on('message', (channel, message) => {});    // Pub/Sub 메시지
client.on('pmessage', (pattern, channel, message) => {});
client.on('smessage', (channel, message) => {});   // 샤드 채널 메시지
client.on('subscribe', (channel, count) => {});    // psubscribe, ssubscribe와 각 unsubscribe 이벤트도 같음
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

> [!NOTE]
>
> - 선언된 타입의 인자로 생긴 에러는 모두 `SolidisError`이고, 원인은 표준 `cause`로 이어집니다.
> - 메시지에는 커맨드 이름(`[INCR] ERR ...`)만 붙고 인자는 붙지 않습니다. 따옴표 안의 텍스트가 인자에 들어 있으면 메시지와 `cause` 모두에서 `'***'`로 가리고, Lua 에러는 첫 따옴표부터 가립니다. 따옴표 없이 되돌려준 값(GEOADD 좌표, `redis.error_reply()` 텍스트, FUNCTION LOAD의 함수 이름)은 그대로 남습니다.
> - 4,096자보다 긴 메시지는 잘리고, 잘린 메시지에서 가린 부분이 있으면 끝까지 가립니다.
> - 인자는 선언된 타입으로만 검사합니다. JavaScript에서 배열 자리에 문자열, 객체 자리에 배열을 넘기거나 ioredis식으로 `set(key, value, 'EX', 10)`을 쓰면 다른 커맨드가 됩니다. 필드 레코드는 객체만 받습니다.
> - ESM과 CJS 빌드의 클라이언트와 커맨드는 섞어 쓸 수 있지만, 에러 클래스는 빌드마다 따로라서 `instanceof`는 같은 빌드의 에러에만 맞습니다.
> - TS.MADD, BF.MADD, BF.INSERT는 거부된 항목을 결과 안의 `RespError`로 돌려줍니다.
> - `send()`, `pipeline()`, `exec()`의 원시 결과에 든 에러 응답은 서버 텍스트를 그대로 둡니다.

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

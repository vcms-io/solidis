<h1 align="center"><img src="./assets/solidis.png" alt="Solidis" width="50"/></h1>

<h3 align="center">
  <b>The fastest Redis client for Node.js.<br/>Zero dependencies, up to 2x faster than ioredis, battle-tested in production.</b>
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
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Rocket.png?raw=true" alt="Rocket" width="32" height="32" /><br/><strong>0 deps</strong><br/><sub>제로 의존성</sub></td>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Package.png?raw=true" alt="Package" width="32" height="32" /><br/><strong>383</strong><br/><sub>커맨드</sub></td>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Test%20Tube.png?raw=true" alt="Test Tube" width="32" height="32" /><br/><strong>25K+</strong><br/><sub>테스트 라인</sub></td>
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
> **번들 크기가 중요하다면?** `SolidisClient` + `.extend()`로 쓰는 커맨드만 가져오세요.
> 트리 쉐이킹 적용 시 **< 29KB**까지 줄일 수 있습니다.

<details>
<summary>&nbsp;&nbsp;<b>트리 쉐이킹 클라이언트</b></summary>

<br/>

```typescript
import { SolidisClient } from '@vcms-io/solidis';
import { get } from '@vcms-io/solidis/command/get';
import { set } from '@vcms-io/solidis/command/set';

const client = new SolidisClient({ host: '127.0.0.1', port: 6379 }).extend({ get, set });
```

`extend()`는 객체가 직접 가진 함수 속성을 클라이언트에 바인딩해 추가합니다.

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

// commandTimeout 대신 이 요청에만 적용할 타임아웃 (0이면 비활성화)
const job = await client.send([['BLPOP', 'jobs', '30']], { timeout: 35_000 });
```

`exec()`는 `MULTI`, 쌓인 커맨드, `EXEC`를 호출 즉시 한 번의 `send()`로 함께 보내므로, 트랜잭션은 그 뒤에 보낸 커맨드보다 먼저 실행됩니다. `send()`처럼 원시 응답으로 resolve되므로, 응답 형태는 프로토콜을 따르고 `{ buffer: true }` 같은 쌓인 호출의 옵션은 적용되지 않습니다. 인자가 거부된 경우처럼 커맨드를 하나도 쌓지 못한 호출이 있거나, `undefined` 인자를 가진 커맨드처럼 `send()`가 거부하는 커맨드가 쌓여 있으면 `exec()`는 reject됩니다. 이렇게 reject되는 `exec()`와 `discard()`는 `UNWATCH`를 보내므로, `WATCH`는 트랜잭션과 함께 끝납니다.
쌓인 호출의 동기 부분만 트랜잭션에 들어갑니다. 응답을 await하는 `extend()` 메서드는 그 뒤의 커맨드를 트랜잭션 밖에서 실행하고, 커맨드를 쌓은 뒤 예외를 던지는 메서드는 이미 쌓은 커맨드를 멈추지 못하므로, 인자는 커맨드를 쌓기 전에 검사하세요.
ACL 사용자에게 `@transaction`이 없을 때처럼 서버가 `MULTI`를 거부하면 쌓인 커맨드가 각각 실행되고 `exec()`는 `[MULTI]` 에러로 reject되므로, 무작정 재시도하지 마세요.
재연결로 `WATCH`가 사라지면 다음 `EXEC`는 `DISCARD`로 바뀌어 `null`을 반환합니다. `send()`로 보낸 `MULTI`가 사라지면 `MULTI`, `EXEC`, `DISCARD`, `RESET` 전까지 다른 커맨드를 거부합니다.

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

블로킹 커맨드는 `commandTimeout`에 자신의 블로킹 타임아웃을 더한 별도 기한을 가지며, 위 예처럼 무한히 기다리면 기한이 없습니다.
기한이 지나면 연결을 리셋해서, 늦게 온 응답이 다른 커맨드에 전달되지 않게 합니다.
다만 서버가 바빠서 아직 실행하지 않은 커맨드는 리셋 뒤에도 실행되어, 아무도 받지 못하는 값을 꺼낼 수 있습니다.

</details>

<details>
<summary>&nbsp;&nbsp;<b>2^53을 넘는 정수</b></summary>

<br/>

```typescript
const views = await client.incr('views', { bigint: true }); // bigint
```

INCR, INCRBY, DECR, DECRBY, HINCRBY, BITFIELD, BITFIELD_RO는 기본적으로 `number`를 반환하고, 결과가 `Number.MAX_SAFE_INTEGER`를 넘으면 에러를 냅니다.
이때 서버에는 이미 반영된 상태이므로, 에러의 `cause`에 정확한 `bigint` 값이 담깁니다.
`{ bigint: true }`를 넘기면 항상 `bigint`를 반환하고, 반환 타입도 옵션을 따라갑니다.
INCRBYFLOAT는 JavaScript 숫자처럼 반올림된 `number`를, HINCRBYFLOAT는 서버가 보낸 정확한 텍스트를 반환합니다.

</details>

<details>
<summary>&nbsp;&nbsp;<b>바이너리 값</b></summary>

<br/>

```typescript
await client.set('image', Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

const image = await client.get('image', { buffer: true });           // Buffer | null
const images = await client.mget('image', 'logo', { buffer: true }); // (Buffer | null)[]
```

SET, SETNX, SETEX, PSETEX, GETSET, SETRANGE, APPEND, MSET, MSETNX, HSET, HSETNX, HMSET, LPUSH, RPUSH, LPUSHX, RPUSHX, LSET, XADD, RESTORE는 `Buffer` 값을 받아 바이트 그대로 저장합니다.
LINSERT, LREM, LPOS, SMISMEMBER, DELEX, SET은 비교할 값으로, PUBLISH와 SPUBLISH는 메시지로, BF.LOADCHUNK와 CF.LOADCHUNK는 청크로, AUTH와 HELLO는 자격 증명으로 `Buffer`를 받습니다. 그 밖의 인자는 문자열이고, `send()`는 어느 인자에나 `Buffer`를 받습니다.
`send()`는 받은 커맨드 배열을 복사하므로 바로 바꾸거나 다시 써도 되지만, 그 안의 `Buffer`는 복사하지 않으니 커맨드가 끝날 때까지 바꾸지 마세요.
읽을 때는 기본적으로 UTF-8로 디코딩하고, GET, GETDEL, GETEX, GETRANGE, MGET, HGET, HMGET, HGETALL, HVALS, LINDEX, LRANGE, LPOP, RPOP, LMOVE, BLMOVE, RPOPLPUSH, BRPOPLPUSH, BLPOP, BRPOP, LMPOP, BLMPOP에 `{ buffer: true }`를 넘기면 정확한 바이트를 `Buffer`로 받습니다.
커맨드는 HGETALL, HSCAN, 스트림 항목의 필드 이름을 UTF-8 텍스트로 디코딩하고, RESP3 맵의 키는 `send()`에서도 UTF-8 텍스트로 디코딩하므로, UTF-8로 유효하지 않은 이름끼리는 겹칠 수 있습니다. 바이너리 데이터는 값에 담으세요.
반환 타입도 옵션을 따라갑니다. MGET과 HMGET은 마지막 인자가 `undefined`이면 키가 아니라 옵션이 없는 것으로 읽습니다.

</details>

<details>
<summary>&nbsp;&nbsp;<b>함께 쓸 수 없는 옵션</b></summary>

<br/>

```typescript
await client.set('key', 'value', { expireInSeconds: 60, setIfKeyNotExists: true });

// 타입 에러: SET은 만료 옵션과 조건 옵션을 하나씩만 받습니다
await client.set('key', 'value', { expireInSeconds: 60, keepOriginalTimeToLive: true });
```

옵션 타입은 커맨드가 받아들이는 조합만 허용합니다. 예를 들어 NX와 XX 중 하나만, BYSCORE와 BYLEX 중 하나만 받고, BYLEX에는 WITHSCORES를 쓸 수 없습니다.

</details>

<details>
<summary>&nbsp;&nbsp;<b>스트림</b></summary>

<br/>

```typescript
const entries = await client.xrange('jobs', '-', '+');
const pending = await client.xpending('jobs', 'workers', '-', '+', 10);
```

스트림 엔트리의 필드는 레코드에 담기므로, 한 엔트리 안에서 반복되는 필드 이름은 마지막 값만 남고, 정수 형태의 필드 이름은 JavaScript 객체처럼 오름차순으로 앞에 옵니다. `xadd()`도 레코드를 받으며, `send()`는 필드와 값의 쌍을 그대로 반환합니다.
`xpending()` 엔트리의 `deliveryTime`은 `XPENDING`이 보고하는 유휴 시간, 즉 마지막으로 전달된 뒤 지난 밀리초입니다.
`xinfoStream(key, true)`의 `deliveryTime`은 `XINFO STREAM FULL`이 보고하는 대로 마지막 전달 시각의 Unix 시간(밀리초)입니다.

</details>

<br/>

<div id="benchmark">

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Bar%20Chart.png?raw=true" alt="Bar Chart" width="25" height="25" /> 벤치마크

<div align="center">

# <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" /> Solidis vs ioredis <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" />

<small>측정일 2026-09-28 10:33:01 · linux x64 · Node.js v22.23.2</small>

### ioredis 대비 최대 **2.1x 빠릅니다**! <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Rocket.png?raw=true" alt="Rocket" width="25" height="25" />

---

<br/>

**15**개 중 **15**개 벤치마크 우위 · 평균 **78%** 성능 향상 · 최대 **111%** 성능 향상

_100,000번 반복 × 10,000 동시 실행 · 1 KB 페이로드 · 10회 측정_

|                                                                                                                                                                                        | 벤치마크            |                                                 명령어                                                  |  solidis   | ioredis |                                                                                                                                                                          차이                                                                                                                                                                           | 성능         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :------------------ | :-----------------------------------------------------------------------------------------------------: | :--------: | :-----: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------- |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **Set 변경**        |               <sup><sub><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sub></sup>                | **1729ms** | 3648ms  | **2.1x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `██████████` |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | **List 변경**       | <sup><sub><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sub></sup> | **2455ms** | 4920ms  | **2.0x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `█████████░` |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | **Set 조회**        |             <sup><sub><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sub></sup>              | **1717ms** | 3214ms  | **1.9x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `████████░░` |
|                                                                                                                                                                                     4. | **List 범위**       |                <sup><sub><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sub></sup>                | **1661ms** | 3095ms  | **1.9x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `████████░░` |
|                                                                                                                                                                                     5. | **Hash 변경**       |                 <sup><sub><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sub></sup>                 | **2046ms** | 3776ms  | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `████████░░` |
|                                                                                                                                                                                     6. | **Multi-Key**       |                          <sup><sub><kbd>MSET</kbd> <kbd>MGET</kbd></sub></sup>                          | **1767ms** | 3242ms  | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `████████░░` |
|                                                                                                                                                                                     7. | **Sorted Set**      |                 <sup><sub><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sub></sup>                 | **1639ms** | 3007ms  | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `████████░░` |
|                                                                                                                                                                                     8. | **Expire**          |                  <sup><sub><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sub></sup>                  | **1023ms** | 1840ms  | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `███████░░░` |
|                                                                                                                                                                                     9. | **Stream**          |                 <sup><sub><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sub></sup>                 | **1830ms** | 3263ms  | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `███████░░░` |
|                                                                                                                                                                                    10. | **Set**             |                                  <sup><sub><kbd>SET</kbd></sub></sup>                                   | **740ms**  | 1306ms  | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `███████░░░` |
|                                                                                                                                                                                    11. | **Hash 왕복**       |                <sup><sub><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sub></sup>                 | **1632ms** | 2703ms  | **1.7x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `██████░░░░` |
|                                                                                                                                                                                    12. | **비트랜잭션**      |                          <sup><sub><kbd>SETPX</kbd> <kbd>GET</kbd></sub></sup>                          | **1077ms** | 1739ms  | **1.6x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `██████░░░░` |
|                                                                                                                                                                                    13. | **Counter**         |                          <sup><sub><kbd>INCR</kbd> <kbd>DECR</kbd></sub></sup>                          | **921ms**  | 1474ms  |                                                                                    **1.6x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     | `█████░░░░░` |
|                                                                                                                                                                                    14. | **파이프라인 혼합** |                   <sup><sub><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sub></sup>                   | **1690ms** | 2600ms  |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     | `█████░░░░░` |
|                                                                                                                                                                                    15. | **Get Buffer**      |                               <sup><sub><kbd>GETBUFFER</kbd></sub></sup>                                | **473ms**  |  716ms  |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     | `█████░░░░░` |

### 엄격 비교가 불가능한 벤치마크

<sub>라이브러리별 고유 동작으로 인해 엄밀한 비교가 어려운 벤치마크입니다.</sub>

|     | 벤치마크          |                                명령어                                 | solidis | ioredis |                                                                                                                                                                          차이                                                                                                                                                                           | 성능         |
| --: | :---------------- | :-------------------------------------------------------------------: | :-----: | :-----: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------- |
| 16. | **트랜잭션**      | <sup><sub><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sub></sup> | 1351ms  | 6479ms  | **4.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `██████████` |
| 17. | **트랜잭션 혼합** |          <sup><sub><kbd>SET</kbd> <kbd>GET</kbd></sub></sup>          | 1545ms  | 5874ms  | **3.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `██████████` |
| 18. | **Pub/Sub**       |      <sup><sub><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sub></sup>      |  782ms  | 2715ms  | **3.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `██████████` |
| 19. | **Info / Config** |      <sup><sub><kbd>INFO</kbd> <kbd>CONFIGGET</kbd></sub></sup>       | 1106ms  | 2256ms  | **2.0x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `█████████░` |

<sub>`solidis`의 `ioredis` (기준) 대비 성능 향상률 순으로 정렬. 소요 시간 = 반복 측정의 중앙값.</sub>

</div>

<br/>

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Bar%20Chart.png?raw=true" alt="Bar Chart" width="25" height="25" /> 상세 지표

<sub>라이브러리별 전체 지표: 초당 작업 수, 초당 명령 수, 소요 시간 중앙값, 분산 (변동 계수).</sub>

<details>
<summary>상세 지표 테이블 펼치기</summary>

| 벤치마크                                                                                                                                   | 라이브러리  |  ops/s | cmds/s | 소요 시간 |  분산 |
| :----------------------------------------------------------------------------------------------------------------------------------------- | :---------- | -----: | -----: | --------: | ----: |
| **Set 변경: <sup><sub><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sub></sup>**<br/><sub>1 KB</sub>                               | **solidis** |  57.8K | 173.5K |    1729ms | ±1.8% |
|                                                                                                                                            | ioredis     |  27.4K |  82.2K |    3648ms | ±2.5% |
| **List 변경: <sup><sub><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** |  40.7K | 203.7K |    2455ms | ±5.2% |
|                                                                                                                                            | ioredis     |  20.3K | 101.6K |    4920ms | ±1.9% |
| **Set 조회: <sup><sub><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sub></sup>**<br/><sub>1 KB</sub>                           | **solidis** |  58.2K | 174.7K |    1717ms | ±1.3% |
|                                                                                                                                            | ioredis     |  31.1K |  93.3K |    3214ms | ±2.5% |
| **List 범위: <sup><sub><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sub></sup>**<br/><sub>1 KB</sub>                               | **solidis** |  60.2K | 180.6K |    1661ms | ±1.8% |
|                                                                                                                                            | ioredis     |  32.3K |  96.9K |    3095ms | ±3.1% |
| **Hash 변경: <sup><sub><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sub></sup>**<br/><sub>1 KB</sub>                                 | **solidis** |  48.9K | 146.6K |    2046ms | ±2.1% |
|                                                                                                                                            | ioredis     |  26.5K |  79.4K |    3776ms | ±4.3% |
| **Multi-Key: <sup><sub><kbd>MSET</kbd> <kbd>MGET</kbd></sub></sup>**<br/><sub>1 KB</sub>                                                   | **solidis** |  56.6K | 113.2K |    1767ms | ±5.2% |
|                                                                                                                                            | ioredis     |  30.8K |  61.7K |    3242ms | ±2.5% |
| **Sorted Set: <sup><sub><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sub></sup>**<br/><sub>1 KB</sub>                                | **solidis** |  61.0K | 183.0K |    1639ms | ±1.9% |
|                                                                                                                                            | ioredis     |  33.3K |  99.8K |    3007ms | ±2.0% |
| **Expire: <sup><sub><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sub></sup>**<br/><sub>1 KB</sub>                                      | **solidis** |  97.8K | 293.4K |    1023ms | ±5.8% |
|                                                                                                                                            | ioredis     |  54.3K | 163.0K |    1840ms | ±4.0% |
| **Stream: <sup><sub><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sub></sup>**<br/><sub>1 KB</sub>                                    | **solidis** |  54.6K | 163.9K |    1830ms | ±2.7% |
|                                                                                                                                            | ioredis     |  30.7K |  92.0K |    3263ms | ±3.1% |
| **Set: <sup><sub><kbd>SET</kbd></sub></sup>**<br/><sub>1 KB</sub>                                                                          | **solidis** | 135.2K | 135.2K |     740ms | ±2.6% |
|                                                                                                                                            | ioredis     |  76.6K |  76.6K |    1306ms | ±1.6% |
| **Hash 왕복: <sup><sub><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sub></sup>**<br/><sub>1 KB</sub>                                | **solidis** |  61.3K | 183.8K |    1632ms | ±6.7% |
|                                                                                                                                            | ioredis     |  37.0K | 111.0K |    2703ms | ±0.9% |
| **비트랜잭션: <sup><sub><kbd>SETPX</kbd> <kbd>GET</kbd></sub></sup>**<br/><sub>1 KB</sub>                                                  | **solidis** |  92.9K | 185.7K |    1077ms | ±5.6% |
|                                                                                                                                            | ioredis     |  57.5K | 115.0K |    1739ms | ±2.6% |
| **Counter: <sup><sub><kbd>INCR</kbd> <kbd>DECR</kbd></sub></sup>**<br/><sub>1 KB</sub>                                                     | **solidis** | 108.5K | 217.1K |     921ms | ±1.7% |
|                                                                                                                                            | ioredis     |  67.9K | 135.7K |    1474ms | ±1.6% |
| **파이프라인 혼합: <sup><sub><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sub></sup>**<br/><sub>1 KB</sub>                               | **solidis** |  59.2K | 177.5K |    1690ms | ±6.4% |
|                                                                                                                                            | ioredis     |  38.5K | 115.4K |    2600ms | ±1.5% |
| **Get Buffer: <sup><sub><kbd>GETBUFFER</kbd></sub></sup>**<br/><sub>1 KB</sub>                                                             | **solidis** | 211.6K | 211.6K |     473ms | ±7.1% |
|                                                                                                                                            | ioredis     | 139.8K | 139.8K |     716ms | ±3.9% |

</details>

---

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Gear.png?raw=true" alt="Gear" width="25" height="25" /> 설정

<details>
<summary>벤치마크 설정 펼치기</summary>

| 항목                   | 값                  |
| :--------------------- | :------------------ |
| 모드                   | `autopipeline`      |
| 페이로드 크기          | 1 KB                |
| 반복 횟수              | 100,000             |
| 워밍업                 | 1,000               |
| 클라이언트 수          | 1                   |
| 클라이언트당 동시 실행 | 10000               |
| 총 동시 실행           | 10000               |
| 측정 횟수              | 10                  |
| 쿨다운                 | 2500ms              |
| 플랫폼                 | linux x64           |
| Node.js                | v22.23.2            |
| 날짜                   | 2026-09-28 10:33:01 |

</details>

---

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Open%20Book.png?raw=true" alt="Open Book" width="25" height="25" /> 측정 방법론

- 각 벤치마크는 GC 및 JIT 간섭을 방지하기 위해 **격리된 워커 스레드**에서 실행됩니다
- 순서 편향을 줄이기 위해 반복 측정 시 라이브러리를 **번갈아 실행**합니다
- Redis 서버는 각 벤치마크 케이스 사이에 **초기화 및 안정화**됩니다
- 페이로드는 두 라이브러리가 공유하는 **결정론적 의사 난수 풀**을 사용합니다
- 소요 시간은 전체 반복 샘플의 **중앙값**입니다
- 분산은 **변동 계수** (σ / 중앙값 × 100%)입니다
- 두 클라이언트 모두 **커맨드 타임아웃, 레디 체크, 재연결을 끈 상태**에서 무제한 오토 파이프라이닝으로 실행됩니다

</div>

## 기능

<table>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" /> 성능

- `setImmediate` 기반 파이프라인 자동 병합
- 선형 시간 증분 RESP 파서
- 64KB 이상 bulk 응답은 복사 없이 뷰로 반환
- 파이프라인을 만드는 즉시 소켓에 쓰고 Node가 `writev`로 병합

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Electric%20Plug.png?raw=true" alt="Electric Plug" width="25" height="25" /> 프로토콜

- RESP2 + RESP3 와이어 레벨 구현 (Redis와 Valkey가 보내지 않는 스트리밍 응답 제외)
- 15가지 RESP3 응답 타입 전부 지원 (Map, Set, Push, Attribute, BigNumber, ...)
- RESP3 push가 커맨드 응답을 가로채지 않음
- 2^53을 넘는 정수는 BigInt로: 원시 응답은 자동, 커맨드는 `{ bigint: true }`
- 바이너리 세이프: 문자열·해시·리스트·스트림 쓰기에 `Buffer` 값, `{ buffer: true }`로 바이트 그대로 읽기

</td>
</tr>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Shield.png?raw=true" alt="Shield" width="25" height="25" /> 안정성

- 지터를 적용한 지수 백오프 기반 자동 재연결
- 핸드셰이크(AUTH, SELECT) 완료 전에는 커맨드를 보내지 않음
- 재연결 시 AUTH, 프로토콜, SELECT, Pub/Sub 구독 자동 복구
- 재연결로 WATCH나 MULTI가 사라진 트랜잭션은 커밋하지 않고 버림
- 파이프라인 또는 `send()` 호출 단위 커맨드 타임아웃, 블로킹 커맨드는 별도 기한
- Ready check로 서버 로딩 완료까지 대기
- 장애 발생 시 in-flight 요청 즉시 reject

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Locked.png?raw=true" alt="Locked" width="25" height="25" /> 보안

- TLS/SSL 지원 (`rediss://` 또는 `tls` 옵션)
- ACL 인증 (username/password)
- 디버그 항목에는 커맨드 이름만 남기고 인자는 남기지 않음
- 에러 메시지에 커맨드 인자를 덧붙이지 않고, 서버가 인용해 돌려준 인자는 가림
- `maxBulkStringLength`와 512단계 중첩 제한으로 비정상 응답 차단

</td>
</tr>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/Bullseye.png?raw=true" alt="Bullseye" width="25" height="25" /> 타입 안전성

- TypeScript `strict` 모드, 커맨드별 I/O 타입 정의
- 함께 쓸 수 없는 옵션은 컴파일 단계에서 거부
- 런타임 응답 가드 (`tryReplyToString`, ...)
- 구조화된 에러 계층 + 표준 `cause` 체인

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/Puzzle%20Piece.png?raw=true" alt="Puzzle Piece" width="25" height="25" /> 확장성

- `.extend()`로 커맨드 조합 (트리 쉐이킹 가능)
- 커스텀 커맨드에서 클라이언트 `this` 접근
- MULTI/EXEC 프록시에서 금지 메서드 자동 차단

</td>
</tr>
</table>

## 설정

<details>
<summary><b>전체 옵션 레퍼런스</b></summary>

```typescript
const client = new SolidisClient({
  // 연결
  uri: 'redis://user:pass@localhost:6379/0', // redis[s]://[user[:password]@]host[:port][/db]
  host: '127.0.0.1',
  port: 6379,
  tls: { /* tls.ConnectionOptions */ },
  lazyConnect: false,

  // 인증
  authentication: { username: 'user', password: 'pass' }, // 빈 username은 default 사용자
  database: 0,

  // 프로토콜 / 복구
  clientName: 'solidis',
  protocol: 'RESP2',                      // 'RESP2' | 'RESP3'
  autoReconnect: true,
  enableReadyCheck: true,
  maxReadyCheckRetries: 100,
  readyCheckInterval: 100,
  maxConnectionRetries: 20,
  connectionRetryDelay: 100,              // 실패할 때마다 두 배, 그 값의 50–100% 사이에서 지터 적용
  maxConnectionRetryDelay: 2000,
  autoRecovery: {
    database: true,
    subscribe: true,
    ssubscribe: true,
    psubscribe: true,
  },

  // 타임아웃 (ms)
  commandTimeout: 5000,                   // 0이면 비활성화, send(commands, { timeout })로 요청별 지정
  connectionTimeout: 2000,

  // 성능 튜닝
  maxCommandsPerPipeline: 300,
  rejectOnPartialPipelineError: false,

  // 파서
  parser: {
    maxBulkStringLength: 536_870_912,       // 512MB
  },

  // 기타
  maxEventListenersForClient: 10_240,
  debug: false,
});
```

직접 지정한 옵션이 `uri`의 각 부분보다 우선합니다.

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

| 모듈           | 역할                                                    |
| :------------- | :------------------------------------------------------ |
| **Connection** | TCP/TLS 소켓 관리, 재연결 백오프                        |
| **Requester**  | 커맨드 큐, 파이프라인 청킹, 응답 매칭, 타임아웃         |
| **Parser**     | RESP 증분 디코딩, 바이너리 세이프 응답 처리             |
| **PubSub**     | 채널/패턴/샤드 상태 추적, 메시지 디스패치               |
| **Debug**      | 커맨드 이름만 담고 인자는 담지 않는 `debug` 이벤트 항목 |

## 이벤트

```typescript
client.on('connect', () => {});                    // TCP 연결 수립
client.on('ready', () => {});                      // 핸드셰이크 완료, 커맨드 전송 가능
client.on('close', (error) => {});                 // 연결 끊김 (autoReconnect면 재연결)
client.on('reconnecting', (attempt, delay) => {}); // 재연결을 시도할 때마다
client.on('reconnected', () => {});                // 재연결 성공
client.on('end', () => {});                        // 클라이언트 종료 (quit)
client.on('error', (error) => {});                 // 치명적이지 않은 에러 (리스너가 없으면 process.emitWarning())
client.on('message', (channel, message) => {});    // Pub/Sub 메시지 수신
client.on('pmessage', (pattern, channel, message) => {});
client.on('smessage', (channel, message) => {});   // Shard 채널 메시지
client.on('push', (reply) => {});                  // 그 밖의 push (예: client tracking 무효화)
client.on('debug', (entry) => {});                 // 디버그 로그 엔트리
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

> [!NOTE]
> 선언된 타입의 인자를 넘겼을 때 Solidis가 throw하는 모든 에러는 `SolidisError`를 상속하고, 원인은 표준 `cause`로 연결됩니다.
> 메시지에는 커맨드 이름(`[INCR] ERR ...`)이 붙고 인자는 붙지 않습니다. 서버가 인용해 돌려준 인자는 메시지와 `cause` 모두에서 `'***'`로 바뀌지만, GEOADD 에러의 좌표나 스크립트가 `redis.error_reply()`에 넘긴 텍스트처럼 서버가 따옴표 없이 되풀이한 값과, FUNCTION LOAD 에러의 라이브러리 이름처럼 서버가 인자 안에서 떼어 낸 텍스트는 서버가 보낸 그대로 남습니다.
> 인자는 선언된 타입으로만 검사합니다. JavaScript에서 배열 자리에 문자열을, 객체 자리에 배열을 넘기거나 `set(key, value, 'EX', 10)` 같은 ioredis식 옵션을 넘기면 다른 커맨드가 만들어지며, 필드 레코드는 객체가 아니면 거부합니다.
> ES 모듈 빌드와 CommonJS 빌드를 함께 불러오는 애플리케이션은 두 빌드의 클라이언트와 커맨드를 섞어 쓸 수 있지만, 빌드마다 에러 클래스가 따로 있어 `instanceof`는 같은 빌드에서 만든 에러만 맞습니다.
> TS.MADD, BF.MADD, BF.INSERT는 항목을 하나씩 저장하므로, 거부된 항목은 호출 전체를 reject하는 대신 결과 배열 안의 `RespError`로 돌려줍니다.

| 에러 클래스              | 발생 조건                                                                                                                       |
| :----------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| `SolidisCommandError`    | 서버 에러 응답 (`cause`는 `RespError`), 예상과 다른 응답, 커맨드가 거부한 옵션                                                  |
| `SolidisClientError`     | `commandTimeout` 안에 준비되지 않음, 핸드셰이크 거부(인증, HELLO, SELECT, CLIENT SETNAME), quit 이후, 예외를 던진 이벤트 리스너 |
| `SolidisConnectionError` | TCP/TLS 연결 실패, 잘못된 포트, 타임아웃, 연결 끊김, 재시도 소진, 서버의 연결 거부                                              |
| `SolidisRequesterError`  | 커맨드 타임아웃, `send()`의 잘못된 커맨드, MONITOR처럼 거부되는 커맨드                                                          |
| `SolidisParserError`     | 잘못된 RESP 포맷, bulk string 또는 줄 크기 초과, 512단계를 넘는 중첩                                                            |
| `SolidisPubSubError`     | 잘못된 pub/sub 이벤트, pub/sub 또는 push 리스너 예외                                                                            |

## 확장

```bash
npm install @vcms-io/solidis-extensions
```

| 확장                                                                                                       | 설명                                     |
| :--------------------------------------------------------------------------------------------------------- | :--------------------------------------- |
| [**SpinLock**](https://github.com/vcms-io/solidis-extensions/blob/main/sources/domains/spinlock/README.md) | 가벼운 Redis 기반 뮤텍스 (단일 인스턴스) |
| [**RedLock**](https://github.com/vcms-io/solidis-extensions/blob/main/sources/domains/redlock/README.md)   | 분산 잠금 (Redlock 알고리즘, 내결함성)   |

## 기여하기

```bash
git clone https://github.com/vcms-io/solidis.git && cd solidis
npm install && npm run build
npm run lint:check # 린트, 포맷, 타입 테스트
SOLIDIS_TEST_PORT=6380 npm test # 테스트가 데이터를 지우므로 버려도 되는 서버를 쓰세요
```

<sub>TypeScript strict · 외부 의존성 추가 금지 · 번들 사이즈 최소화 · SemVer</sub>

## 라이선스

MIT · [LICENSE](/LICENSE) 참조

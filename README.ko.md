<h1 align="center"><img src="./assets/solidis.png" alt="Solidis" width="50"/></h1>

<h3 align="center">
  <b>Node.js에서 가장 빠른 Redis 클라이언트.<br/>의존성 제로, 벤치마크 19개 모두 1위, 프로덕션에서 검증된 안정성.</b>
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

`extend()`는 객체의 함수를 클라이언트에 바인딩해 붙입니다.

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

// 이 요청에만 적용할 타임아웃 (0이면 끔)
const job = await client.send([['BLPOP', 'jobs', '30']], { timeout: 35_000 });
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

옵션 타입은 커맨드가 받는 조합만 허용합니다. NX와 XX 중 하나, BYSCORE와 BYLEX 중 하나만 받고, BYLEX와 WITHSCORES는 함께 쓸 수 없습니다.

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

<small>측정일 2026-10-04 23:27:09 · linux x64 · Node.js v22.23.0 · Redis 8.10.2</small>

### 벤치마크 **19**개 중 **19**개에서 가장 빠름 · 다음으로 빠른 클라이언트보다 평균 **1.5x** 처리량 <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Rocket.png?raw=true" alt="Rocket" width="25" height="25" />

### 순위

|                                                                                                                                                                                        | 클라이언트   | 버전  |    1위 횟수 |    처리량 | 작업당 CPU |       최대 메모리 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------- | :---- | ----------: | --------: | ---------: | ----------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **solidis**  | 0.5.0 | **19** / 19 | **1.00x** |  **1.00x** |         **1.00x** |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | node-redis   | 6.3.0 |      0 / 19 |     0.63x |      1.19x |             0.97x |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | speedkey     | 0.4.2 |      0 / 19 |     0.48x |      1.99x | 0.46x<sup>†</sup> |
|                                                                                                                                                                                     4. | iovalkey     | 0.4.0 |      0 / 19 |     0.39x |      2.30x |             1.51x |
|                                                                                                                                                                                     5. | valkey-glide | 2.5.3 |      0 / 19 |     0.38x |      2.56x | 1.10x<sup>†</sup> |
|                                                                                                                                                                                     6. | ioredis      | 6.0.0 |      0 / 19 |     0.38x |      2.36x |             1.43x |

<sub>처리량, 작업당 CPU, 최대 메모리는 모든 벤치마크의 기하평균이며, `solidis`(1.00x) 대비 값입니다. 처리량은 높을수록, CPU와 메모리는 낮을수록 좋습니다.</sub>

<sub><sup>†</sup> 클라이언트가 네이티브 코드에서 쓰는 메모리는 포함하지 않습니다.</sub>

### 초당 작업 수

_작업 100,000회 × 동시 실행 10,000 · 1 KB 페이로드 · 클라이언트마다 5회 측정_

|                                                                                                                                                                                        | 벤치마크                                                                                                       | **solidis** |            ioredis |           iovalkey | node-redis |       valkey-glide |           speedkey |                                                                                                                                                                          차이                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------- | ----------: | -----------------: | -----------------: | ---------: | -----------------: | -----------------: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup>                                               |  **417.5K** |              53.1K |              56.0K |      58.1K |  43.9K<sup>1</sup> | 145.8K<sup>1</sup> | **2.9x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | **트랜잭션 혼합**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup>                                                 |  **135.7K** |              27.9K |              30.4K |      61.5K |  42.2K<sup>2</sup> |              47.0K | **2.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | **트랜잭션**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup>                                    |  **170.2K** |              35.6K |              39.1K |      77.6K |  67.3K<sup>2</sup> |              55.9K | **2.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
|                                                                                                                                                                                     4. | **Set**<br/><sup><kbd>SET</kbd></sup>                                                                          |  **358.6K** |             144.7K |             151.0K |     216.6K |             115.7K |             173.3K | **1.7x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
|                                                                                                                                                                                     5. | **Set 조회**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup>                           |  **158.7K** |              60.0K |              61.0K |     105.4K |  69.9K<sup>3</sup> |  81.8K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     6. | **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup>                                      |  **176.7K** |              74.7K |              74.0K |     118.0K |  81.6K<sup>3</sup> |  93.5K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     7. | **파이프라인 혼합**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup>                               |  **161.5K** |              72.2K |              72.8K |     110.1K |  73.3K<sup>3</sup> |  84.0K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     8. | **Set 변경**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup>                               |  **150.6K** |              54.6K |              55.9K |     104.0K |  68.9K<sup>3</sup> |  95.2K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     9. | **비트랜잭션**<br/><sup><kbd>SETPX</kbd> <kbd>GET</kbd></sup>                                                  |  **199.1K** |              85.0K |              85.4K |     139.5K |  84.8K<sup>3</sup> | 105.1K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    10. | **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup>                                |  **135.8K** |              58.5K |              58.6K |      96.6K |  60.3K<sup>3</sup> |  67.9K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    11. | **Hash 변경**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup>                                 |  **129.7K** |              56.4K |              57.4K |      92.6K |  50.8K<sup>3</sup> |  62.3K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    12. | **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup>                                                   |  **146.6K** |              62.7K |              67.8K |     104.9K |  62.9K<sup>3</sup> |  73.2K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    13. | **List 범위**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup>                               |  **129.1K** |              54.8K |              56.4K |      93.2K |  59.0K<sup>3</sup> |  74.0K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    14. | **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup>                                                     |  **256.4K** |             122.3K |             126.9K |     188.4K | 105.6K<sup>3</sup> | 134.6K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    15. | **Hash 왕복**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup>                                |  **139.9K** |              67.3K |              70.7K |     106.4K |  60.1K<sup>3</sup> |  69.0K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    16. | **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIGGET</kbd></sup>                                          |  **221.2K** | 111.7K<sup>4</sup> | 114.3K<sup>4</sup> |     169.6K |  89.9K<sup>3</sup> |  94.7K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    17. | **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup>                                    |  **138.6K** |              57.7K |              59.6K |     106.8K |  53.6K<sup>3</sup> |  55.7K<sup>3</sup> |                                                                           **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    18. | **List 변경**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup> |  **108.6K** |              41.6K |              41.8K |      90.3K |  49.3K<sup>3</sup> |  57.5K<sup>3</sup> |                                                                           **1.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    19. | **Get**<br/><sup><kbd>GET</kbd></sup>                                                                          |  **337.7K** |             194.5K |             193.7K |     303.7K |             113.3K |             193.3K |                                                                           **1.1x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |

<sub>반복 측정의 초당 작업 수 중앙값이며, 벤치마크마다 가장 빠른 클라이언트를 굵게 표시합니다. 차이 = `solidis` ÷ 다른 클라이언트 중 가장 빠른 값.</sub>

<sub><sup>1</sup> Pub/Sub에는 RESP3가 필요해 RESP3로 구독합니다</sub><br/>
<sub><sup>2</sup> 배치에 MULTI와 EXEC를 넣을 수 없어, 그 사이의 커맨드를 원자적 배치로 보냅니다</sub><br/>
<sub><sup>3</sup> 동시에 보낸 커맨드의 순서를 지키지 않아, 작업마다 배치 하나로 보냅니다</sub><br/>
<sub><sup>4</sup> INFO는 오토 파이프라이닝하지 않습니다</sub>

</div>

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Bar%20Chart.png?raw=true" alt="Bar Chart" width="25" height="25" /> 상세 지표

<sub>라이브러리별 초당 작업 수와 커맨드 수, 지연 시간(p50 / p95 / p99 / p99.9), 작업당 CPU와 GC 시간, 최대 메모리, 분산입니다.</sub>

<details>
<summary>상세 지표 펼치기</summary>

| 벤치마크                                                                                                                           | 라이브러리               |  ops/s | cmds/s |      p50 |      p95 |      p99 |    p99.9 | CPU/작업 | GC/작업 |               메모리 |  분산 |
| :--------------------------------------------------------------------------------------------------------------------------------- | :----------------------- | -----: | -----: | -------: | -------: | -------: | -------: | -------: | ------: | -------------------: | ----: |
| **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup><br/><sub>1 KB</sub>                                               | **solidis**              | 417.5K | 417.5K |   4.96ms |  10.27ms |  26.44ms |  29.96ms |   3.69µs |  0.23µs |              24.2 MB | ±1.3% |
|                                                                                                                                    | ioredis                  |  53.1K |  53.1K |  44.06ms |  68.07ms |  75.53ms |  88.93ms |  24.45µs |  1.81µs |             144.2 MB | ±1.1% |
|                                                                                                                                    | iovalkey                 |  56.0K |  56.0K |  43.02ms |  64.05ms |  68.85ms |  78.33ms |  23.47µs |  1.90µs |             155.2 MB | ±0.9% |
|                                                                                                                                    | node-redis               |  58.1K |  58.1K |  37.40ms |  64.54ms |  70.38ms |  79.49ms |  18.96µs |  1.85µs |              79.7 MB | ±0.8% |
|                                                                                                                                    | valkey-glide<sup>1</sup> |  43.9K |  43.9K |  51.15ms |  81.31ms |  85.22ms |  90.88ms |  55.88µs |  1.93µs | 128.6 MB<sup>†</sup> | ±0.8% |
|                                                                                                                                    | speedkey<sup>1</sup>     | 145.8K | 145.8K |  14.48ms |  21.78ms |  28.31ms |  32.42ms |  15.82µs |  0.57µs |  21.3 MB<sup>†</sup> | ±4.6% |
| **트랜잭션 혼합**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                 | **solidis**              | 135.7K | 814.5K |  68.93ms |  99.09ms | 119.42ms | 128.27ms |  16.84µs |  2.05µs |             355.5 MB | ±0.9% |
|                                                                                                                                    | ioredis                  |  27.9K | 167.7K | 351.02ms | 378.23ms | 385.29ms | 390.82ms |  59.53µs |  6.38µs |             676.4 MB | ±1.4% |
|                                                                                                                                    | iovalkey                 |  30.4K | 182.4K | 323.21ms | 350.36ms | 368.03ms | 372.39ms |  56.81µs |  7.08µs |             715.4 MB | ±1.4% |
|                                                                                                                                    | node-redis               |  61.5K | 368.9K | 158.00ms | 187.25ms | 192.70ms | 198.00ms |  30.48µs |  4.13µs |             492.7 MB | ±1.7% |
|                                                                                                                                    | valkey-glide<sup>2</sup> |  42.2K | 253.5K | 233.14ms | 254.52ms | 271.97ms | 279.47ms |  53.07µs |  7.64µs | 360.1 MB<sup>†</sup> | ±0.9% |
|                                                                                                                                    | speedkey                 |  47.0K | 281.9K | 208.67ms | 241.19ms | 253.41ms | 256.57ms |  43.09µs |  0.00µs | 216.4 MB<sup>†</sup> | ±1.4% |
| **트랜잭션**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              | 170.2K | 850.8K |  52.88ms |  98.70ms | 114.76ms | 119.78ms |  12.26µs |  1.69µs |             276.7 MB | ±1.4% |
|                                                                                                                                    | ioredis                  |  35.6K | 178.0K | 274.66ms | 296.69ms | 305.72ms | 319.44ms |  45.90µs |  5.41µs |             620.1 MB | ±1.2% |
|                                                                                                                                    | iovalkey                 |  39.1K | 195.7K | 250.26ms | 276.46ms | 286.39ms | 298.10ms |  44.36µs |  6.02µs |             657.4 MB | ±1.7% |
|                                                                                                                                    | node-redis               |  77.6K | 387.9K | 122.85ms | 146.93ms | 160.35ms | 162.97ms |  25.17µs |  3.60µs |             525.1 MB | ±2.5% |
|                                                                                                                                    | valkey-glide<sup>2</sup> |  67.3K | 336.5K | 139.25ms | 165.90ms | 178.64ms | 197.75ms |  32.16µs |  5.31µs | 379.4 MB<sup>†</sup> | ±2.7% |
|                                                                                                                                    | speedkey                 |  55.9K | 279.4K | 173.86ms | 205.76ms | 211.22ms | 215.61ms |  35.91µs |  0.00µs | 204.3 MB<sup>†</sup> | ±1.2% |
| **Set**<br/><sup><kbd>SET</kbd></sup><br/><sub>1 KB</sub>                                                                          | **solidis**              | 358.6K | 358.6K |  25.11ms |  49.14ms |  56.68ms |  61.17ms |   6.58µs |  1.04µs |             180.1 MB | ±5.5% |
|                                                                                                                                    | ioredis                  | 144.7K | 144.7K |  64.02ms |  94.34ms | 104.65ms | 106.63ms |  13.28µs |  1.95µs |             305.6 MB | ±2.5% |
|                                                                                                                                    | iovalkey                 | 151.0K | 151.0K |  61.52ms |  87.32ms |  94.63ms |  99.31ms |  12.79µs |  1.98µs |             273.9 MB | ±1.6% |
|                                                                                                                                    | node-redis               | 216.6K | 216.6K |  43.03ms |  50.23ms |  53.87ms |  57.25ms |   8.03µs |  1.66µs |             178.3 MB | ±1.6% |
|                                                                                                                                    | valkey-glide             | 115.7K | 115.7K |  82.33ms |  91.01ms |  96.02ms | 100.27ms |  18.30µs |  2.00µs | 214.6 MB<sup>†</sup> | ±1.9% |
|                                                                                                                                    | speedkey                 | 173.3K | 173.3K |  54.91ms |  74.54ms |  86.03ms |  91.03ms |  14.68µs |  1.04µs | 159.5 MB<sup>†</sup> | ±2.7% |
| **Set 조회**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup><br/><sub>1 KB</sub>                           | **solidis**              | 158.7K | 476.1K |  58.89ms |  87.92ms | 108.85ms | 113.56ms |  14.14µs |  2.08µs |             326.5 MB | ±1.3% |
|                                                                                                                                    | ioredis                  |  60.0K | 180.1K | 162.49ms | 195.03ms | 200.82ms | 201.94ms |  35.42µs |  4.64µs |             392.1 MB | ±0.7% |
|                                                                                                                                    | iovalkey                 |  61.0K | 182.9K | 160.00ms | 194.25ms | 205.02ms | 206.94ms |  35.28µs |  4.81µs |             397.6 MB | ±1.0% |
|                                                                                                                                    | node-redis               | 105.4K | 316.1K |  92.80ms | 104.53ms | 119.27ms | 120.02ms |  15.00µs |  3.13µs |             275.7 MB | ±2.8% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  69.9K | 209.7K | 137.62ms | 155.44ms | 159.11ms | 165.07ms |  30.78µs |  5.03µs | 319.6 MB<sup>†</sup> | ±0.8% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  81.8K | 245.4K | 117.15ms | 130.63ms | 141.41ms | 144.26ms |  25.36µs |  0.00µs |  78.6 MB<sup>†</sup> | ±1.0% |
| **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup><br/><sub>1 KB</sub>                                      | **solidis**              | 176.7K | 530.0K |  51.16ms |  80.24ms |  91.85ms | 107.47ms |  12.51µs |  1.98µs |             312.7 MB | ±2.9% |
|                                                                                                                                    | ioredis                  |  74.7K | 224.2K | 130.79ms | 157.44ms | 164.98ms | 168.87ms |  25.15µs |  3.95µs |             461.6 MB | ±2.6% |
|                                                                                                                                    | iovalkey                 |  74.0K | 222.1K | 131.67ms | 150.55ms | 154.16ms | 157.16ms |  25.59µs |  4.21µs |             484.9 MB | ±1.5% |
|                                                                                                                                    | node-redis               | 118.0K | 354.0K |  80.98ms |  95.03ms | 101.86ms | 104.23ms |  13.27µs |  3.20µs |             241.6 MB | ±3.1% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  81.6K | 244.9K | 117.21ms | 135.03ms | 142.10ms | 147.35ms |  25.29µs |  4.82µs | 409.2 MB<sup>†</sup> | ±1.7% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  93.5K | 280.5K | 105.60ms | 116.26ms | 122.01ms | 130.82ms |  22.40µs |  0.00µs | 122.8 MB<sup>†</sup> | ±1.6% |
| **파이프라인 혼합**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              | 161.5K | 484.4K |  58.28ms |  92.04ms | 104.72ms | 106.67ms |  14.29µs |  2.15µs |             325.5 MB | ±4.0% |
|                                                                                                                                    | ioredis                  |  72.2K | 216.5K | 136.18ms | 161.47ms | 166.25ms | 170.67ms |  28.40µs |  4.21µs |             499.7 MB | ±2.5% |
|                                                                                                                                    | iovalkey                 |  72.8K | 218.3K | 132.79ms | 163.48ms | 169.06ms | 171.66ms |  28.09µs |  4.36µs |             522.3 MB | ±3.1% |
|                                                                                                                                    | node-redis               | 110.1K | 330.2K |  87.98ms | 103.89ms | 110.30ms | 112.65ms |  14.37µs |  3.19µs |             276.8 MB | ±2.6% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  73.3K | 219.8K | 128.31ms | 152.07ms | 155.69ms | 160.27ms |  28.82µs |  5.00µs | 340.4 MB<sup>†</sup> | ±0.8% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  84.0K | 251.9K | 115.61ms | 125.29ms | 133.46ms | 142.15ms |  25.20µs |  0.00µs |  76.5 MB<sup>†</sup> | ±0.7% |
| **Set 변경**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              | 150.6K | 451.8K |  58.57ms | 103.64ms | 124.93ms | 133.37ms |  15.49µs |  2.31µs |             289.9 MB | ±3.1% |
|                                                                                                                                    | ioredis                  |  54.6K | 163.7K | 185.32ms | 200.61ms | 212.06ms | 214.32ms |  36.16µs |  4.95µs |             188.3 MB | ±1.1% |
|                                                                                                                                    | iovalkey                 |  55.9K | 167.8K | 169.56ms | 195.54ms | 204.68ms | 205.97ms |  37.66µs |  4.81µs |             276.7 MB | ±7.6% |
|                                                                                                                                    | node-redis               | 104.0K | 311.9K |  94.01ms | 109.10ms | 116.42ms | 121.85ms |  14.56µs |  3.14µs |             227.6 MB | ±2.8% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  68.9K | 206.7K | 139.75ms | 160.74ms | 169.06ms | 175.29ms |  30.09µs |  5.11µs | 343.0 MB<sup>†</sup> | ±1.7% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  95.2K | 285.5K | 103.68ms | 113.75ms | 116.57ms | 118.43ms |  22.25µs |  0.00µs |  89.1 MB<sup>†</sup> | ±2.3% |
| **비트랜잭션**<br/><sup><kbd>SETPX</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                  | **solidis**              | 199.1K | 398.3K |  45.58ms |  79.14ms |  92.98ms | 101.02ms |  11.42µs |  1.61µs |             272.7 MB | ±2.0% |
|                                                                                                                                    | ioredis                  |  85.0K | 170.0K | 113.46ms | 140.56ms | 160.52ms | 161.72ms |  23.13µs |  3.18µs |             384.6 MB | ±2.0% |
|                                                                                                                                    | iovalkey                 |  85.4K | 170.8K | 112.20ms | 135.43ms | 143.84ms | 146.62ms |  22.25µs |  3.29µs |             418.8 MB | ±2.6% |
|                                                                                                                                    | node-redis               | 139.5K | 279.1K |  68.63ms |  81.04ms |  87.25ms |  98.01ms |  11.61µs |  2.53µs |             223.3 MB | ±4.1% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  84.8K | 169.6K | 109.44ms | 127.99ms | 132.94ms | 138.93ms |  25.73µs |  4.19µs | 311.0 MB<sup>†</sup> | ±0.8% |
|                                                                                                                                    | speedkey<sup>3</sup>     | 105.1K | 210.3K |  92.88ms | 100.91ms | 106.13ms | 109.33ms |  20.42µs |  0.00µs | 195.2 MB<sup>†</sup> | ±1.1% |
| **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup><br/><sub>1 KB</sub>                                | **solidis**              | 135.8K | 407.4K |  67.59ms |  97.25ms | 115.33ms | 122.95ms |  16.53µs |  2.41µs |             405.3 MB | ±2.0% |
|                                                                                                                                    | ioredis                  |  58.5K | 175.4K | 166.70ms | 191.91ms | 217.62ms | 221.37ms |  36.57µs |  4.53µs |             377.2 MB | ±1.5% |
|                                                                                                                                    | iovalkey                 |  58.6K | 175.8K | 165.14ms | 196.37ms | 207.60ms | 212.51ms |  36.34µs |  4.81µs |             383.7 MB | ±1.9% |
|                                                                                                                                    | node-redis               |  96.6K | 289.9K |  99.77ms | 119.96ms | 126.33ms | 128.94ms |  16.58µs |  3.38µs |             330.0 MB | ±0.9% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  60.3K | 180.9K | 158.49ms | 184.47ms | 189.25ms | 191.33ms |  35.13µs |  5.88µs | 349.9 MB<sup>†</sup> | ±0.7% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  67.9K | 203.7K | 143.45ms | 166.81ms | 182.60ms | 186.57ms |  29.63µs |  0.00µs | 205.5 MB<sup>†</sup> | ±2.7% |
| **Hash 변경**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup><br/><sub>1 KB</sub>                                 | **solidis**              | 129.7K | 389.0K |  69.61ms | 101.08ms | 115.97ms | 122.42ms |  17.89µs |  2.21µs |             395.9 MB | ±1.2% |
|                                                                                                                                    | ioredis                  |  56.4K | 169.1K | 177.42ms | 204.60ms | 214.29ms | 222.56ms |  44.45µs |  4.93µs |             455.4 MB | ±1.7% |
|                                                                                                                                    | iovalkey                 |  57.4K | 172.2K | 174.74ms | 195.80ms | 204.24ms | 208.57ms |  43.87µs |  5.32µs |             429.1 MB | ±2.3% |
|                                                                                                                                    | node-redis               |  92.6K | 277.9K | 104.29ms | 121.05ms | 127.62ms | 129.41ms |  17.89µs |  3.29µs |             320.9 MB | ±2.2% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  50.8K | 152.5K | 188.32ms | 216.73ms | 223.24ms | 228.87ms |  41.77µs |  6.47µs | 335.3 MB<sup>†</sup> | ±2.7% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  62.3K | 186.8K | 155.32ms | 179.84ms | 185.87ms | 189.20ms |  31.89µs |  0.00µs | 191.3 MB<sup>†</sup> | ±0.6% |
| **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup><br/><sub>1 KB</sub>                                                   | **solidis**              | 146.6K | 293.2K |  64.87ms |  86.66ms | 102.64ms | 106.84ms |  15.51µs |  1.84µs |             351.0 MB | ±4.6% |
|                                                                                                                                    | ioredis                  |  62.7K | 125.4K | 159.44ms | 180.37ms | 186.73ms | 187.89ms |  38.68µs |  4.27µs |             403.0 MB | ±2.7% |
|                                                                                                                                    | iovalkey                 |  67.8K | 135.6K | 146.55ms | 177.02ms | 183.04ms | 187.39ms |  31.93µs |  3.88µs |             449.1 MB | ±2.1% |
|                                                                                                                                    | node-redis               | 104.9K | 209.8K |  91.93ms | 103.36ms | 107.35ms | 110.32ms |  16.35µs |  2.75µs |             311.8 MB | ±1.9% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  62.9K | 125.8K | 153.11ms | 169.49ms | 174.12ms | 179.28ms |  35.73µs |  4.73µs | 269.9 MB<sup>†</sup> | ±0.8% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  73.2K | 146.3K | 131.30ms | 159.37ms | 167.69ms | 174.75ms |  27.41µs |  0.00µs | 170.8 MB<sup>†</sup> | ±2.0% |
| **List 범위**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              | 129.1K | 387.4K |  69.48ms | 104.96ms | 111.58ms | 117.81ms |  17.98µs |  2.38µs |             410.4 MB | ±2.4% |
|                                                                                                                                    | ioredis                  |  54.8K | 164.5K | 180.49ms | 205.11ms | 223.00ms | 230.01ms |  45.18µs |  5.18µs |             447.3 MB | ±2.4% |
|                                                                                                                                    | iovalkey                 |  56.4K | 169.1K | 175.08ms | 197.98ms | 204.19ms | 206.38ms |  42.87µs |  5.16µs |             425.8 MB | ±2.6% |
|                                                                                                                                    | node-redis               |  93.2K | 279.5K | 102.98ms | 120.83ms | 131.61ms | 138.21ms |  17.52µs |  3.29µs |             318.7 MB | ±1.8% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  59.0K | 177.0K | 161.20ms | 186.00ms | 190.10ms | 194.73ms |  38.07µs |  5.54µs | 302.0 MB<sup>†</sup> | ±0.8% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  74.0K | 221.9K | 131.92ms | 159.68ms | 164.41ms | 167.16ms |  28.28µs |  0.00µs | 180.1 MB<sup>†</sup> | ±2.3% |
| **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup><br/><sub>1 KB</sub>                                                     | **solidis**              | 256.4K | 512.7K |  35.11ms |  54.29ms |  62.54ms |  66.64ms |   9.76µs |  1.62µs |             250.4 MB | ±3.9% |
|                                                                                                                                    | ioredis                  | 122.3K | 244.6K |  74.38ms | 116.69ms | 122.45ms | 126.35ms |  17.23µs |  3.04µs |             347.4 MB | ±3.9% |
|                                                                                                                                    | iovalkey                 | 126.9K | 253.9K |  71.76ms | 112.54ms | 116.53ms | 120.67ms |  17.11µs |  3.07µs |             375.9 MB | ±2.3% |
|                                                                                                                                    | node-redis               | 188.4K | 376.8K |  49.72ms |  65.01ms |  69.98ms |  72.57ms |   9.37µs |  2.43µs |             220.7 MB | ±1.8% |
|                                                                                                                                    | valkey-glide<sup>3</sup> | 105.6K | 211.2K |  89.12ms | 117.34ms | 128.92ms | 141.00ms |  22.13µs |  3.66µs | 377.4 MB<sup>†</sup> | ±2.4% |
|                                                                                                                                    | speedkey<sup>3</sup>     | 134.6K | 269.1K |  70.86ms |  81.26ms |  88.83ms |  93.72ms |  16.75µs |  0.00µs |  45.9 MB<sup>†</sup> | ±1.2% |
| **Hash 왕복**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup><br/><sub>1 KB</sub>                                | **solidis**              | 139.9K | 419.7K |  65.34ms |  91.66ms | 110.34ms | 123.69ms |  16.79µs |  2.22µs |             374.4 MB | ±3.6% |
|                                                                                                                                    | ioredis                  |  67.3K | 201.8K | 142.93ms | 178.37ms | 183.91ms | 188.00ms |  31.34µs |  4.24µs |             491.0 MB | ±3.4% |
|                                                                                                                                    | iovalkey                 |  70.7K | 212.1K | 136.68ms | 167.16ms | 194.45ms | 204.77ms |  31.74µs |  4.61µs |             505.6 MB | ±3.7% |
|                                                                                                                                    | node-redis               | 106.4K | 319.1K |  91.65ms | 109.76ms | 114.65ms | 119.09ms |  16.11µs |  3.27µs |             341.6 MB | ±3.5% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  60.1K | 180.4K | 157.43ms | 187.25ms | 192.14ms | 196.41ms |  35.23µs |  5.64µs | 327.0 MB<sup>†</sup> | ±2.6% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  69.0K | 207.0K | 138.74ms | 164.27ms | 167.02ms | 169.60ms |  30.48µs |  0.00µs | 167.0 MB<sup>†</sup> | ±2.1% |
| **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIGGET</kbd></sup><br/><sub>1 KB</sub>                                          | **solidis**              | 221.2K | 442.5K |  39.92ms |  72.78ms |  87.85ms |  96.08ms |  10.94µs |  1.69µs |             287.1 MB | ±2.8% |
|                                                                                                                                    | ioredis<sup>4</sup>      | 111.7K | 223.3K |  83.55ms | 123.31ms | 128.99ms | 133.21ms |  16.95µs |  2.24µs |             278.0 MB | ±1.7% |
|                                                                                                                                    | iovalkey<sup>4</sup>     | 114.3K | 228.5K |  79.61ms | 119.15ms | 124.82ms | 130.07ms |  17.10µs |  2.46µs |             308.4 MB | ±1.6% |
|                                                                                                                                    | node-redis               | 169.6K | 339.2K |  54.51ms |  73.40ms |  80.89ms |  85.73ms |  10.94µs |  2.39µs |             248.2 MB | ±1.9% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  89.9K | 179.7K | 101.29ms | 142.54ms | 160.12ms | 165.78ms |  26.16µs |  4.25µs | 380.3 MB<sup>†</sup> | ±2.1% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  94.7K | 189.3K | 102.92ms | 118.38ms | 123.10ms | 126.22ms |  21.52µs |  0.00µs | 233.5 MB<sup>†</sup> | ±1.1% |
| **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              | 138.6K | 415.9K |  67.12ms |  95.89ms | 114.17ms | 120.31ms |  16.02µs |  2.41µs |             396.2 MB | ±2.2% |
|                                                                                                                                    | ioredis                  |  57.7K | 173.0K | 169.91ms | 191.79ms | 195.88ms | 199.37ms |  32.78µs |  4.38µs |             455.3 MB | ±1.7% |
|                                                                                                                                    | iovalkey                 |  59.6K | 178.8K | 164.89ms | 188.04ms | 191.75ms | 193.13ms |  30.59µs |  4.60µs |             495.8 MB | ±1.0% |
|                                                                                                                                    | node-redis               | 106.8K | 320.5K |  90.33ms | 104.94ms | 109.48ms | 115.20ms |  15.16µs |  3.40µs |             330.1 MB | ±1.5% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  53.6K | 160.7K | 173.50ms | 212.92ms | 220.80ms | 223.60ms |  39.15µs |  6.36µs | 391.5 MB<sup>†</sup> | ±1.5% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  55.7K | 167.1K | 174.89ms | 202.00ms | 211.53ms | 214.93ms |  35.60µs |  0.00µs | 207.0 MB<sup>†</sup> | ±1.8% |
| **List 변경**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup><br/><sub>1 KB</sub> | **solidis**              | 108.6K | 542.9K |  86.13ms | 119.68ms | 152.21ms | 167.19ms |  21.64µs |  3.16µs |             417.3 MB | ±1.5% |
|                                                                                                                                    | ioredis                  |  41.6K | 207.8K | 243.81ms | 266.02ms | 286.00ms | 293.12ms |  56.88µs |  8.16µs |             521.1 MB | ±2.9% |
|                                                                                                                                    | iovalkey                 |  41.8K | 208.8K | 241.55ms | 257.17ms | 263.68ms | 265.03ms |  55.86µs |  8.43µs |             539.5 MB | ±1.2% |
|                                                                                                                                    | node-redis               |  90.3K | 451.6K | 104.91ms | 129.15ms | 138.29ms | 150.48ms |  20.21µs |  2.25µs |             359.3 MB | ±1.6% |
|                                                                                                                                    | valkey-glide<sup>3</sup> |  49.3K | 246.6K | 198.86ms | 222.67ms | 229.10ms | 235.09ms |  43.28µs |  6.85µs | 341.7 MB<sup>†</sup> | ±1.8% |
|                                                                                                                                    | speedkey<sup>3</sup>     |  57.5K | 287.6K | 168.30ms | 187.84ms | 192.95ms | 194.78ms |  36.08µs |  0.00µs | 103.6 MB<sup>†</sup> | ±1.1% |
| **Get**<br/><sup><kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                                          | **solidis**              | 337.7K | 337.7K |  27.16ms |  38.90ms |  51.52ms |  58.54ms |   6.45µs |  0.86µs |             117.2 MB | ±3.3% |
|                                                                                                                                    | ioredis                  | 194.5K | 194.5K |  47.05ms |  74.78ms |  85.28ms |  90.09ms |  10.23µs |  1.63µs |             277.6 MB | ±2.9% |
|                                                                                                                                    | iovalkey                 | 193.7K | 193.7K |  47.18ms |  76.83ms |  87.73ms |  94.95ms |  10.33µs |  1.72µs |             294.3 MB | ±1.2% |
|                                                                                                                                    | node-redis               | 303.7K | 303.7K |  28.77ms |  43.36ms |  48.32ms |  50.53ms |   7.73µs |  1.06µs |              88.8 MB | ±4.6% |
|                                                                                                                                    | valkey-glide             | 113.3K | 113.3K |  81.51ms | 134.61ms | 157.17ms | 164.19ms |  19.90µs |  1.22µs |  82.9 MB<sup>†</sup> | ±2.0% |
|                                                                                                                                    | speedkey                 | 193.3K | 193.3K |  49.17ms |  61.87ms |  69.05ms |  74.57ms |  15.04µs |  1.07µs |   0.0 MB<sup>†</sup> | ±1.9% |

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
| 연결당 동시 실행     | 10000                                                                                              |
| 측정 횟수            | 5                                                                                                  |
| 쿨다운               | 300ms                                                                                              |
| 날짜                 | 2026-10-04 23:27:09                                                                                |

</details>

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Open%20Book.png?raw=true" alt="Open Book" width="25" height="25" /> 측정 방법론

- 샘플마다 **별도 워커 스레드**에서 실행하므로 GC와 JIT 상태가 다음 라이브러리로 넘어가지 않습니다.
- 샘플마다 라이브러리 순서를 **바꾸고**, 매번 서버를 **비우고 안정화**한 뒤 측정합니다.
- 모든 라이브러리가 같은 **결정론적 바이너리 페이로드**를 쓰고, 측정이 끝나면 모든 응답을 검사합니다.
- 처리량은 반복 측정의 **중앙값**이고, 분산은 σ / 중앙값입니다.
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
- 서버 로딩이 끝날 때까지 기다리는 ready check
- 장애가 나면 처리 중인 요청을 확실하게 실패 처리

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Locked.png?raw=true" alt="Locked" width="25" height="25" /> 보안

- TLS (`rediss://` 또는 `tls` 옵션)
- ACL 사용자 이름과 비밀번호
- 디버그 항목에는 커맨드 이름만 남기고 인자는 남기지 않음
- 서버가 에러 메시지에 되돌려준 인자는 가림
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
  lazyConnect: false,

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
    maxBulkStringLength: 536_870_912,       // 512MB
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

| 에러 클래스              | 발생 조건                                                               |
| :----------------------- | :---------------------------------------------------------------------- |
| `SolidisCommandError`    | 서버 에러(`cause`는 `RespError`), 예상과 다른 응답, 거부된 옵션         |
| `SolidisClientError`     | 제한 시간 안에 준비되지 않음, 핸드셰이크 거부, quit, 예외를 던진 리스너 |
| `SolidisConnectionError` | 연결 실패와 타임아웃, 잘못된 포트, 연결 끊김, 재시도 소진, 연결 거부    |
| `SolidisRequesterError`  | 커맨드 타임아웃, 잘못된 `send()` 커맨드, MONITOR처럼 거부되는 커맨드    |
| `SolidisParserError`     | 잘못된 RESP, 너무 큰 bulk string이나 줄, 512단계를 넘는 중첩            |
| `SolidisPubSubError`     | 잘못된 Pub/Sub 이벤트, 예외를 던진 Pub/Sub·push 리스너                  |

> [!NOTE]
>
> - 선언된 타입의 인자로 생긴 에러는 모두 `SolidisError`이고, 원인은 표준 `cause`로 이어집니다.
> - 메시지에는 커맨드 이름(`[INCR] ERR ...`)만 붙고 인자는 붙지 않습니다. 서버가 따옴표로 되돌려준 인자는 메시지와 `cause` 모두에서 `'***'`로 가립니다. 따옴표 없이 되돌려준 값(GEOADD 좌표, `redis.error_reply()` 텍스트, FUNCTION LOAD의 라이브러리 이름)은 그대로 남습니다.
> - 4,096자보다 긴 메시지는 잘리고, 잘려서 닫히지 않은 따옴표 안의 인자는 끝까지 가립니다.
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

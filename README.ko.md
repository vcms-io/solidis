<h1 align="center"><img src="./assets/solidis.png" alt="Solidis" width="50"/></h1>

<p align="center">
  <b>Zero-dependency RESP client for Redis. Fastest by design.</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@vcms-io/solidis"><img src="https://img.shields.io/npm/v/@vcms-io/solidis.svg?style=flat-square&labelColor=000&color=f5a623" alt="npm"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/coverage-98%25-brightgreen?style=flat-square&labelColor=000" alt="coverage"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square&labelColor=000" alt="deps"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/min_bundle-<29KB-blue?style=flat-square&labelColor=000" alt="bundle"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/RESP2%2FRESP3-full-orange?style=flat-square&labelColor=000" alt="RESP"></a>
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
<td align="center"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Rocket.png" alt="Rocket" width="32" height="32" style="vertical-align: middle" /><br/><strong>0 deps</strong><br/><sub>제로 의존성</sub></td>
<td align="center"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Package.png" alt="Package" width="32" height="32" style="vertical-align: middle" /><br/><strong>383</strong><br/><sub>커맨드</sub></td>
<td align="center"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Test%20Tube.png" alt="Test Tube" width="32" height="32" style="vertical-align: middle" /><br/><strong>19K+</strong><br/><sub>테스트 라인</sub></td>
<td align="center"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Feather.png" alt="Feather" width="32" height="32" style="vertical-align: middle" /><br/><strong>&lt; 29KB</strong><br/><sub>최소 번들</sub></td>
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

import type { SolidisClientExtensions } from '@vcms-io/solidis';

const extensions = { get, set } satisfies SolidisClientExtensions;
const client = new SolidisClient({ host: '127.0.0.1', port: 6379 }).extend(extensions);
```

</details>

<details>
<summary>&nbsp;&nbsp;<b>트랜잭션 & 파이프라인</b></summary>

<br/>

```typescript
// 트랜잭션 (MULTI/EXEC)
const tx = client.multi();
tx.set('key', 'value');
tx.incr('counter');
const results = await tx.exec();

// 파이프라인 (raw)
const results = await client.send([
  ['set', 'a', '1'],
  ['incr', 'counter'],
  ['get', 'a']
]);
```

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

<br/>

<div id="benchmark">

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Bar%20Chart.png" alt="Bar Chart" width="25" height="25" style="vertical-align: middle" /> 벤치마크

<div align="center">

# <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/High%20Voltage.png" alt="High Voltage" width="25" height="25" style="vertical-align: middle" /> Solidis vs ioredis <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/High%20Voltage.png" alt="High Voltage" width="25" height="25" style="vertical-align: middle" />

<small>측정일 2026-06-19 17:48:54 · linux x64 · Node.js v22.22.3</small>
### ioredis 대비 최대 **2.1x 빠릅니다**! <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Rocket.png" alt="Rocket" width="25" height="25" style="vertical-align: middle" />

---
<br/>

**15**개 중 **15**개 벤치마크 우위 · 평균 **72%** 성능 향상 · 최대 **109%** 성능 향상

*100,000번 반복 × 10,000 동시 실행 · 1 KB 페이로드 · 10회 측정*

| | 벤치마크 | 명령어 | solidis | ioredis | 차이 | 성능 |
|---:|:---|:---:|:---:|:---:|:---:|:---|
| <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/1st%20Place%20Medal.png" alt="1st Place Medal" width="20" height="20" style="vertical-align: middle" /> | **Set 변경** | <sup><sub><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sub></sup> | **1638ms** | 3419ms | **2.1x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `██████████` |
| <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/2nd%20Place%20Medal.png" alt="2nd Place Medal" width="20" height="20" style="vertical-align: middle" /> | **List 변경** | <sup><sub><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sub></sup> | **2373ms** | 4520ms | **1.9x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `████████░░` |
| <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/3rd%20Place%20Medal.png" alt="3rd Place Medal" width="20" height="20" style="vertical-align: middle" /> | **List 범위** | <sup><sub><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sub></sup> | **1905ms** | 3616ms | **1.9x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `████████░░` |
| 4. | **Hash 변경** | <sup><sub><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sub></sup> | **1869ms** | 3391ms | **1.8x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `███████░░░` |
| 5. | **Set** | <sup><sub><kbd>SET</kbd></sub></sup> | **763ms** | 1379ms | **1.8x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `███████░░░` |
| 6. | **Expire** | <sup><sub><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sub></sup> | **1495ms** | 2598ms | **1.7x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `███████░░░` |
| 7. | **Set 조회** | <sup><sub><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sub></sup> | **1876ms** | 3205ms | **1.7x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `███████░░░` |
| 8. | **Stream** | <sup><sub><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sub></sup> | **1856ms** | 3162ms | **1.7x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `██████░░░░` |
| 9. | **Sorted Set** | <sup><sub><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sub></sup> | **1925ms** | 3275ms | **1.7x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `██████░░░░` |
| 10. | **Multi-Key** | <sup><sub><kbd>MSET</kbd> <kbd>MGET</kbd></sub></sup> | **1769ms** | 2946ms | **1.7x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `██████░░░░` |
| 11. | **비트랜잭션** | <sup><sub><kbd>SETPX</kbd> <kbd>GET</kbd></sub></sup> | **1307ms** | 2169ms | **1.7x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `██████░░░░` |
| 12. | **파이프라인 혼합** | <sup><sub><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sub></sup> | **1580ms** | 2546ms | **1.6x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `██████░░░░` |
| 13. | **Counter** | <sup><sub><kbd>INCR</kbd> <kbd>DECR</kbd></sub></sup> | **903ms** | 1397ms | **1.5x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `█████░░░░░` |
| 14. | **Hash 왕복** | <sup><sub><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sub></sup> | **1777ms** | 2706ms | **1.5x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `█████░░░░░` |
| 15. | **Get Buffer** | <sup><sub><kbd>GETBUFFER</kbd></sub></sup> | **598ms** | 883ms | **1.5x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `████░░░░░░` |

### 엄격 비교가 불가능한 벤치마크

<sub>라이브러리별 고유 동작으로 인해 엄밀한 비교가 어려운 벤치마크입니다.</sub>

| | 벤치마크 | 명령어 | solidis | ioredis | 차이 | 성능 |
|---:|:---|:---:|:---:|:---:|:---:|:---|
| 16. | **트랜잭션** | <sup><sub><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sub></sup> | 1257ms | 5958ms | **4.7x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `██████████` |
| 17. | **트랜잭션 혼합** | <sup><sub><kbd>SET</kbd> <kbd>GET</kbd></sub></sup> | 1641ms | 7003ms | **4.3x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `██████████` |
| 18. | **Pub/Sub** | <sup><sub><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sub></sup> | 558ms | 2078ms | **3.7x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `██████████` |
| 19. | **Info / Config** | <sup><sub><kbd>INFO</kbd> <kbd>CONFIGGET</kbd></sub></sup> | 1063ms | 2160ms | **2.0x** <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Fire.png" alt="Fire" width="16" height="16" style="vertical-align: middle" /> | `█████████░` |

<sub>`solidis`의 `ioredis` (기준) 대비 성능 향상률 순으로 정렬. 소요 시간 = 반복 측정의 중앙값.</sub>

</div>

<br/>

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Bar%20Chart.png" alt="Bar Chart" width="25" height="25" style="vertical-align: middle" /> 상세 지표

<sub>라이브러리별 전체 지표: 초당 작업 수, 초당 명령 수, 소요 시간 중앙값, 분산 (변동 계수).</sub>

<details>
<summary>상세 지표 테이블 펼치기</summary>

| 벤치마크 | 라이브러리 | ops/s | cmds/s | 소요 시간 | 분산 |
|:---|:---|---:|---:|---:|---:|
| **Set 변경: <sup><sub><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** | 61.0K | 183.1K | 1638ms | ±7.5% |
|  | ioredis | 29.2K | 87.7K | 3419ms | ±2.3% |
| **List 변경: <sup><sub><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** | 42.1K | 210.7K | 2373ms | ±3.4% |
|  | ioredis | 22.1K | 110.6K | 4520ms | ±0.8% |
| **List 범위: <sup><sub><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** | 52.5K | 157.5K | 1905ms | ±7.9% |
|  | ioredis | 27.7K | 83.0K | 3616ms | ±1.6% |
| **Hash 변경: <sup><sub><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** | 53.5K | 160.5K | 1869ms | ±4.4% |
|  | ioredis | 29.5K | 88.5K | 3391ms | ±3.2% |
| **Set: <sup><sub><kbd>SET</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** | 131.1K | 131.1K | 763ms | ±7.7% |
|  | ioredis | 72.5K | 72.5K | 1379ms | ±2.6% |
| **Expire: <sup><sub><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** | 66.9K | 200.6K | 1495ms | ±2.7% |
|  | ioredis | 38.5K | 115.5K | 2598ms | ±0.9% |
| **Set 조회: <sup><sub><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** | 53.3K | 159.9K | 1876ms | ±7.6% |
|  | ioredis | 31.2K | 93.6K | 3205ms | ±2.1% |
| **Stream: <sup><sub><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** | 53.9K | 161.6K | 1856ms | ±3.8% |
|  | ioredis | 31.6K | 94.9K | 3162ms | ±1.7% |
| **Sorted Set: <sup><sub><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** | 51.9K | 155.8K | 1925ms | ±4.8% |
|  | ioredis | 30.5K | 91.6K | 3275ms | ±1.4% |
| **Multi-Key: <sup><sub><kbd>MSET</kbd> <kbd>MGET</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** | 56.5K | 113.1K | 1769ms | ±1.9% |
|  | ioredis | 33.9K | 67.9K | 2946ms | ±4.3% |
| **비트랜잭션: <sup><sub><kbd>SETPX</kbd> <kbd>GET</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** | 76.5K | 153.0K | 1307ms | ±6.1% |
|  | ioredis | 46.1K | 92.2K | 2169ms | ±5.6% |
| **파이프라인 혼합: <sup><sub><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** | 63.3K | 189.9K | 1580ms | ±1.6% |
|  | ioredis | 39.3K | 117.8K | 2546ms | ±0.5% |
| **Counter: <sup><sub><kbd>INCR</kbd> <kbd>DECR</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** | 110.7K | 221.4K | 903ms | ±2.7% |
|  | ioredis | 71.6K | 143.1K | 1397ms | ±6.6% |
| **Hash 왕복: <sup><sub><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** | 56.3K | 168.8K | 1777ms | ±3.1% |
|  | ioredis | 37.0K | 110.9K | 2706ms | ±3.7% |
| **Get Buffer: <sup><sub><kbd>GETBUFFER</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** | 167.2K | 167.2K | 598ms | ±2.3% |
|  | ioredis | 113.3K | 113.3K | 883ms | ±2.2% |

</details>

---

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Gear.png" alt="Gear" width="25" height="25" style="vertical-align: middle" /> 설정

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
| 날짜 | 2026-06-19 17:48:54 |

</details>

---

## <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Open%20Book.png" alt="Open Book" width="25" height="25" style="vertical-align: middle" /> 측정 방법론

- 각 벤치마크는 GC 및 JIT 간섭을 방지하기 위해 **격리된 워커 스레드**에서 실행됩니다
- 순서 편향을 줄이기 위해 반복 측정 시 라이브러리를 **번갈아 실행**합니다
- Redis 서버는 각 벤치마크 케이스 사이에 **초기화 및 안정화**됩니다
- 페이로드는 두 라이브러리가 공유하는 **결정론적 의사 난수 풀**을 사용합니다
- 소요 시간은 전체 반복 샘플의 **중앙값**입니다
- 분산은 **변동 계수** (σ / 중앙값 × 100%)입니다

</div>

## 기능

<table>
<tr>
<td width="50%" valign="top">

### <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/High%20Voltage.png" alt="High Voltage" width="25" height="25" style="vertical-align: middle" /> 성능

- `setImmediate` 기반 파이프라인 자동 병합
- Zero-copy RESP 파서 (버퍼 슬라이스 재사용)
- 백프레셔 대응 청크 단위 소켓 쓰기
- 이벤트 루프 양보 포인트 설정 가능

</td>
<td width="50%" valign="top">

### <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Electric%20Plug.png" alt="Electric Plug" width="25" height="25" style="vertical-align: middle" /> 프로토콜

- RESP2 + RESP3 와이어 레벨 풀 구현
- 17가지 RESP3 데이터 타입 전부 지원 (Map, Set, Push, BigNumber, ...)
- unsafe integer 자동 BigInt 변환
- 바이너리 세이프, 멀티바이트 문자 정상 처리

</td>
</tr>
<tr>
<td width="50%" valign="top">

### <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Shield.png" alt="Shield" width="25" height="25" style="vertical-align: middle" /> 안정성

- 자동 재연결 (configurable backoff)
- 재연결 시 SELECT, Pub/Sub 구독 자동 복구
- 파이프라인 단위 커맨드 타임아웃
- Ready check로 서버 로딩 완료까지 대기
- 장애 발생 시 in-flight 요청 즉시 reject

</td>
<td width="50%" valign="top">

### <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Objects/Locked.png" alt="Locked" width="25" height="25" style="vertical-align: middle" /> 보안

- TLS/SSL 지원 (`rediss://` 또는 `tls` 옵션)
- ACL 인증 (username/password)
- 디버그 로그에서 자격 증명 자동 마스킹
- `maxBulkStringLength`로 비정상 응답 차단

</td>
</tr>
<tr>
<td width="50%" valign="top">

### <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/Bullseye.png" alt="Bullseye" width="25" height="25" style="vertical-align: middle" /> 타입 안전성

- TypeScript `strict` 모드, 커맨드별 I/O 타입 정의
- 런타임 응답 가드 (`tryReplyToString`, ...)
- 구조화된 에러 계층 + cause chain

</td>
<td width="50%" valign="top">

### <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/Puzzle%20Piece.png" alt="Puzzle Piece" width="25" height="25" style="vertical-align: middle" /> 확장성

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
  uri: 'redis://localhost:6379',
  host: '127.0.0.1',
  port: 6379,
  tls: { /* tls.ConnectionOptions */ },
  lazyConnect: false,

  // 인증
  authentication: { username: 'user', password: 'pass' },
  database: 0,

  // 프로토콜 / 복구
  clientName: 'solidis',
  protocol: 'RESP2',                      // 'RESP2' | 'RESP3'
  autoReconnect: true,
  enableReadyCheck: true,
  maxReadyCheckRetries: 100,
  readyCheckInterval: 100,
  maxConnectionRetries: 20,
  connectionRetryDelay: 100,
  autoRecovery: {
    database: true,
    subscribe: true,
    ssubscribe: true,
    psubscribe: true,
  },

  // 타임아웃 (ms)
  commandTimeout: 5000,
  connectionTimeout: 2000,
  socketWriteTimeout: 1000,

  // 성능 튜닝
  maxCommandsPerPipeline: 300,
  maxProcessRepliesPerChunk: 4096,
  maxProcessReplyBytesPerChunk: 8_388_608,  // 8MB
  maxSocketWriteSizePerOnce: 65_536,        // 64KB
  rejectOnPartialPipelineError: false,

  // 파서
  parser: {
    buffer: { initial: 4_194_304, shiftThreshold: 2_097_152 },
    maxBulkStringLength: 536_870_912,       // 512MB
  },

  // 기타
  maxEventListenersForClient: 10_240,
  maxEventListenersForSocket: 10_240,
  debug: false,
  debugMaxEntries: 10_240,
});
```

</details>

## 아키텍처

```mermaid
graph TD
  subgraph SolidisClient
    direction LR
    Conn[Connection<br/><sub>TCP · TLS · Reconnect</sub>]
    Req[Requester<br/><sub>Queue · Pipeline · Timeout</sub>]
    Parse[Parser<br/><sub>RESP2 · RESP3 · Zero-copy</sub>]
    PS[PubSub<br/><sub>Channel · Pattern · Shard</sub>]
    DM[Debug Memory<br/><sub>Ring buffer · Sanitized</sub>]
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
  Req->>Socket: write pipeline chunk
  Socket-->>Req: RESP reply bytes
  Req-->>Client: parsed reply
  Client-->>App: 'OK'
```

| 모듈 | 역할 |
|:-------|:---------------|
| **Connection** | TCP/TLS 소켓 관리, 재연결 백오프 |
| **Requester** | 커맨드 큐, 파이프라인 청킹, 응답 매칭, 타임아웃 |
| **Parser** | RESP 디코딩, 버퍼 관리, zero-copy 슬라이싱 |
| **PubSub** | 채널/패턴/샤드 상태 추적, 메시지 디스패치 |
| **Debug Memory** | 링 버퍼 기반 디버그 로그, credential 마스킹 |

## 이벤트

```typescript
client.on('connect', () => {});         // TCP 연결 수립
client.on('ready', () => {});           // 인증 완료, 커맨드 전송 가능
client.on('reconnected', () => {});     // 재연결 성공
client.on('end', () => {});             // 연결 종료
client.on('error', (err) => {});        // 소켓/프로토콜 에러
client.on('message', (ch, msg) => {});  // Pub/Sub 메시지 수신
client.on('pmessage', (pat, ch, msg) => {});
client.on('smessage', (ch, msg) => {}); // Shard 채널 메시지
client.on('debug', (entry) => {});      // 디버그 로그 엔트리
```

## 에러 처리

```typescript
import { unwrapSolidisError, SolidisConnectionError, SolidisRequesterError } from '@vcms-io/solidis';

try {
  await client.set('key', 'value');
} catch (error) {
  const root = unwrapSolidisError(error); // cause chain 전체 추적
}
```

> [!NOTE]
> Solidis가 throw하는 모든 에러는 `SolidisError`를 상속합니다.
> `unwrapSolidisError()`로 root cause까지 cause chain을 추적할 수 있습니다.

| 에러 클래스 | 발생 조건 |
|:------------|:-----|
| `SolidisConnectionError` | TCP/TLS 연결 실패, 타임아웃, 소켓 리셋 |
| `SolidisRequesterError` | 커맨드 타임아웃, 파이프라인 reject, 쓰기 실패 |
| `SolidisParserError` | 잘못된 RESP 포맷, bulk string 크기 초과 |
| `SolidisPubSubError` | 구독 상태 관련 에러 |

## 확장

```bash
npm install @vcms-io/solidis-extensions
```

| 확장 | 설명 |
|:----------|:------------|
| [**SpinLock**](https://github.com/vcms-io/solidis-extensions/blob/main/sources/domains/spinlock/README.md) | 가벼운 Redis 기반 뮤텍스 (단일 인스턴스) |
| [**RedLock**](https://github.com/vcms-io/solidis-extensions/blob/main/sources/domains/redlock/README.md) | 분산 잠금 (Redlock 알고리즘, 내결함성) |

## 기여하기

```bash
git clone https://github.com/vcms-io/solidis.git && cd solidis
npm install && npm run build && npm test
```

<sub>TypeScript strict · 외부 의존성 추가 금지 · 번들 사이즈 최소화 · SemVer</sub>

## 라이선스

MIT · [LICENSE](/LICENSE) 참조

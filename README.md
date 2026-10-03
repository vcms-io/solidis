<h1 align="center"><img src="./assets/solidis.png" alt="Solidis" width="50"/></h1>

<h3 align="center">
  <b>The fastest Redis client for Node.js.<br/>Zero dependencies, up to 2x faster than ioredis, battle-tested in production.</b>
</h3>

<br/>

<p align="center">
  <a href="https://www.npmjs.com/package/@vcms-io/solidis"><img src="https://img.shields.io/npm/v/@vcms-io/solidis.svg?style=flat-square&labelColor=000&color=f5a623" alt="npm"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/coverage-100%25-brightgreen?style=flat-square&labelColor=000" alt="coverage"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square&labelColor=000" alt="deps"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/bundle-<29KB-blue?style=flat-square&labelColor=000" alt="bundle"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/RESP2%2FRESP3-full-orange?style=flat-square&labelColor=000" alt="RESP"></a>
  <a href="https://github.com/vcms-io/solidis"><img src="https://img.shields.io/badge/ESM%2FCJS-dual-yellow?style=flat-square&labelColor=000" alt="modules"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#features">Features</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#configuration">Configuration</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#architecture">Architecture</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#extensions">Extensions</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="./README.ko.md">한국어</a>
</p>

<br/>

<p align="center">
  <img src="./assets/bundle.png" alt="Bundle size comparison" width="640"/>
</p>

<table align="center">
<tr>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Rocket.png?raw=true" alt="Rocket" width="32" height="32" /><br/><strong>0 deps</strong><br/><sub>zero dependencies</sub></td>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Package.png?raw=true" alt="Package" width="32" height="32" /><br/><strong>383</strong><br/><sub>commands</sub></td>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Test%20Tube.png?raw=true" alt="Test Tube" width="32" height="32" /><br/><strong>25K+</strong><br/><sub>lines of tests</sub></td>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Animals/Feather.png?raw=true" alt="Feather" width="32" height="32" /><br/><strong>&lt; 29KB</strong><br/><sub>min bundle</sub></td>
</tr>
</table>

<br/>

## Quick Start

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
> **Need a smaller bundle?** Use `SolidisClient` with `.extend()` to import only the commands you use.
> Minimum bundle drops to **< 29KB** with tree-shaking.

<details>
<summary>&nbsp;&nbsp;<b>Tree-shakable client</b></summary>

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
<summary>&nbsp;&nbsp;<b>Transactions & Pipelines</b></summary>

<br/>

```typescript
// Transaction (MULTI/EXEC)
const tx = client.multi();
tx.set('key', 'value');
tx.incr('counter');
const results = await tx.exec(); // null when a WATCHed key changed

// Pipeline (raw)
const replies = await client.send([
  ['set', 'a', '1'],
  ['incr', 'counter'],
  ['get', 'a']
]);

// A timeout for this request only, instead of commandTimeout (0 disables it)
const job = await client.send([['BLPOP', 'jobs', '30']], { timeout: 35_000 });
```

`exec()` sends `MULTI`, the queued commands and `EXEC` together, in one `send()` call. An `exec()` that rejects because a queued call failed, and `discard()`, send `UNWATCH`, so a `WATCH` ends with its transaction.
Only the synchronous part of a queued call joins the transaction: an `extend()` method that awaits a reply runs its later commands outside it.
If the server refuses `MULTI`, as for an ACL user without `@transaction`, the queued commands run on their own and `exec()` rejects with the `[MULTI]` error, so do not retry it blindly.
When a reconnect loses a `WATCH`, the next `EXEC` is sent as `DISCARD` and returns `null`. When it loses a `MULTI` sent with `send()`, other commands are refused until `MULTI`, `EXEC`, `DISCARD` or `RESET`.

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
<summary>&nbsp;&nbsp;<b>Blocking commands</b></summary>

<br/>

```typescript
// BLPOP & co. hold the whole connection until they return, so give them a dedicated client
const worker = new SolidisFeaturedClient({ host: '127.0.0.1', port: 6379 });

const job = await worker.blpop(['jobs'], 0); // a timeout of 0 waits forever
```

A blocking command gets its own deadline: `commandTimeout` plus its blocking timeout, and none when it blocks forever as above.
When that deadline passes, the connection is reset so the server cannot pop a value nobody receives.

</details>

<details>
<summary>&nbsp;&nbsp;<b>Integers beyond 2^53</b></summary>

<br/>

```typescript
const views = await client.incr('views', { bigint: true }); // bigint
```

INCR, INCRBY, DECR, DECRBY, HINCRBY, BITFIELD and BITFIELD_RO return `number` by default and reject a result beyond `Number.MAX_SAFE_INTEGER`.
The server has already applied the command by then, so the error's `cause` carries the exact `bigint`.
Pass `{ bigint: true }` to always receive a `bigint`; the return type follows the option.
INCRBYFLOAT returns a `number`, rounded like any JavaScript number, while HINCRBYFLOAT returns the exact text the server sends.

</details>

<details>
<summary>&nbsp;&nbsp;<b>Binary values</b></summary>

<br/>

```typescript
await client.set('image', Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

const image = await client.get('image', { buffer: true });           // Buffer | null
const images = await client.mget('image', 'logo', { buffer: true }); // (Buffer | null)[]
```

SET, SETNX, SETEX, PSETEX, GETSET, SETRANGE, APPEND, MSET, MSETNX, HSET, HSETNX, HMSET, LPUSH, RPUSH, LPUSHX, RPUSHX, LSET, XADD and RESTORE take `Buffer` values and store them byte for byte.
LINSERT, LREM, LPOS, SMISMEMBER, DELEX and SET also take `Buffer`s for the values they compare, PUBLISH and SPUBLISH for messages, BF.LOADCHUNK and CF.LOADCHUNK for chunks, and AUTH and HELLO for credentials; other arguments are strings, and `send()` takes a `Buffer` for any argument.
Reads decode UTF-8 by default; pass `{ buffer: true }` to receive the exact bytes as a `Buffer` from GET, GETDEL, GETEX, GETRANGE, MGET, HGET, HMGET, HGETALL, HVALS, LINDEX, LRANGE, LPOP, RPOP, LMOVE, BLMOVE, RPOPLPUSH, BRPOPLPUSH, BLPOP, BRPOP, LMPOP, BLMPOP.
The return type follows the option.

</details>

<details>
<summary>&nbsp;&nbsp;<b>Mutually exclusive options</b></summary>

<br/>

```typescript
await client.set('key', 'value', { expireInSeconds: 60, setIfKeyNotExists: true });

// Type error: SET accepts one expiration and one condition
await client.set('key', 'value', { expireInSeconds: 60, keepOriginalTimeToLive: true });
```

Option types accept only the combinations the command itself accepts: for example one of NX and XX, one of BYSCORE and BYLEX, and no WITHSCORES with BYLEX.

</details>

<details>
<summary>&nbsp;&nbsp;<b>Streams</b></summary>

<br/>

```typescript
const entries = await client.xrange('jobs', '-', '+');
const pending = await client.xpending('jobs', 'workers', '-', '+', 10);
```

Stream entries hold their fields in a record, so a field name that repeats within one entry keeps only its last value, and field names that are integers come first, in ascending order, as in any JavaScript object. `xadd()` takes a record as well; `send()` returns the raw field-value pairs.
In `xpending()` entries, `deliveryTime` is the idle time `XPENDING` reports: the milliseconds since the entry was last delivered.
In `xinfoStream(key, true)`, `deliveryTime` is the Unix time of the last delivery in milliseconds, as `XINFO STREAM FULL` reports it.

</details>

<br/>

<div id="benchmark">

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Bar%20Chart.png?raw=true" alt="Bar Chart" width="25" height="25" /> Benchmarks

<div align="center">

# <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" /> Solidis vs ioredis <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" />

<small>Generated on 2026-09-28 10:33:01 · linux x64 · Node.js v22.23.2</small>

### Up to **2.1x faster** than ioredis! <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Rocket.png?raw=true" alt="Rocket" width="25" height="25" />

---

<br/>

**15** / **15** benchmarks won · **78%** average speed improvement · **111%** peak speed improvement

_100,000 iterations × 10,000 concurrency · 1 KB payload · 10 repeats_

|                                                                                                                                                                                        | Benchmark           |                                                Commands                                                 |  solidis   | ioredis |                                                                                                                                                                       Difference                                                                                                                                                                        | Performance  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :------------------ | :-----------------------------------------------------------------------------------------------------: | :--------: | :-----: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------- |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **Set Mutation**    |               <sup><sub><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sub></sup>                | **1729ms** | 3648ms  | **2.1x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `██████████` |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | **List Mutation**   | <sup><sub><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sub></sup> | **2455ms** | 4920ms  | **2.0x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `█████████░` |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | **Set Read**        |             <sup><sub><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sub></sup>              | **1717ms** | 3214ms  | **1.9x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `████████░░` |
|                                                                                                                                                                                     4. | **List Range**      |                <sup><sub><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sub></sup>                | **1661ms** | 3095ms  | **1.9x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `████████░░` |
|                                                                                                                                                                                     5. | **Hash Mutation**   |                 <sup><sub><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sub></sup>                 | **2046ms** | 3776ms  | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `████████░░` |
|                                                                                                                                                                                     6. | **Multi-Key**       |                          <sup><sub><kbd>MSET</kbd> <kbd>MGET</kbd></sub></sup>                          | **1767ms** | 3242ms  | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `████████░░` |
|                                                                                                                                                                                     7. | **Sorted Set**      |                 <sup><sub><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sub></sup>                 | **1639ms** | 3007ms  | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `████████░░` |
|                                                                                                                                                                                     8. | **Expire**          |                  <sup><sub><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sub></sup>                  | **1023ms** | 1840ms  | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `███████░░░` |
|                                                                                                                                                                                     9. | **Stream**          |                 <sup><sub><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sub></sup>                 | **1830ms** | 3263ms  | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `███████░░░` |
|                                                                                                                                                                                    10. | **Set**             |                                  <sup><sub><kbd>SET</kbd></sub></sup>                                   | **740ms**  | 1306ms  | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `███████░░░` |
|                                                                                                                                                                                    11. | **Hash Round-Trip** |                <sup><sub><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sub></sup>                 | **1632ms** | 2703ms  | **1.7x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `██████░░░░` |
|                                                                                                                                                                                    12. | **Non-Transaction** |                          <sup><sub><kbd>SETPX</kbd> <kbd>GET</kbd></sub></sup>                          | **1077ms** | 1739ms  | **1.6x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `██████░░░░` |
|                                                                                                                                                                                    13. | **Counter**         |                          <sup><sub><kbd>INCR</kbd> <kbd>DECR</kbd></sub></sup>                          | **921ms**  | 1474ms  |                                                                                    **1.6x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     | `█████░░░░░` |
|                                                                                                                                                                                    14. | **Pipeline Mixed**  |                   <sup><sub><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sub></sup>                   | **1690ms** | 2600ms  |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     | `█████░░░░░` |
|                                                                                                                                                                                    15. | **Get Buffer**      |                               <sup><sub><kbd>GETBUFFER</kbd></sub></sup>                                | **473ms**  |  716ms  |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     | `█████░░░░░` |

### Non Strictly Comparable Benchmarks

<sub>These benchmarks have library-specific behavior that prevents a strictly fair comparison.</sub>

|     | Benchmark             |                               Commands                                | solidis | ioredis |                                                                                                                                                                       Difference                                                                                                                                                                        | Performance  |
| --: | :-------------------- | :-------------------------------------------------------------------: | :-----: | :-----: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------- |
| 16. | **Transaction**       | <sup><sub><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sub></sup> | 1351ms  | 6479ms  | **4.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `██████████` |
| 17. | **Transaction Mixed** |          <sup><sub><kbd>SET</kbd> <kbd>GET</kbd></sub></sup>          | 1545ms  | 5874ms  | **3.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `██████████` |
| 18. | **Pub/Sub**           |      <sup><sub><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sub></sup>      |  782ms  | 2715ms  | **3.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `██████████` |
| 19. | **Info / Config**     |      <sup><sub><kbd>INFO</kbd> <kbd>CONFIGGET</kbd></sub></sup>       | 1106ms  | 2256ms  | **2.0x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> | `█████████░` |

<sub>Ranked by performance gain of `solidis` over `ioredis` (baseline). Elapsed = median time across repeats.</sub>

</div>

<br/>

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Bar%20Chart.png?raw=true" alt="Bar Chart" width="25" height="25" /> Detailed Metrics

<sub>All metrics per library: operations/s, commands/s, median elapsed time, and spread (coefficient of variation).</sub>

<details>
<summary>Click to expand detailed metrics table</summary>

| Benchmark                                                                                                                                      | Library     |  ops/s | cmds/s | Elapsed | Spread |
| :--------------------------------------------------------------------------------------------------------------------------------------------- | :---------- | -----: | -----: | ------: | -----: |
| **Set Mutation: <sup><sub><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sub></sup>**<br/><sub>1 KB</sub>                               | **solidis** |  57.8K | 173.5K |  1729ms |  ±1.8% |
|                                                                                                                                                | ioredis     |  27.4K |  82.2K |  3648ms |  ±2.5% |
| **List Mutation: <sup><sub><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sub></sup>**<br/><sub>1 KB</sub> | **solidis** |  40.7K | 203.7K |  2455ms |  ±5.2% |
|                                                                                                                                                | ioredis     |  20.3K | 101.6K |  4920ms |  ±1.9% |
| **Set Read: <sup><sub><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sub></sup>**<br/><sub>1 KB</sub>                               | **solidis** |  58.2K | 174.7K |  1717ms |  ±1.3% |
|                                                                                                                                                | ioredis     |  31.1K |  93.3K |  3214ms |  ±2.5% |
| **List Range: <sup><sub><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sub></sup>**<br/><sub>1 KB</sub>                                  | **solidis** |  60.2K | 180.6K |  1661ms |  ±1.8% |
|                                                                                                                                                | ioredis     |  32.3K |  96.9K |  3095ms |  ±3.1% |
| **Hash Mutation: <sup><sub><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sub></sup>**<br/><sub>1 KB</sub>                                 | **solidis** |  48.9K | 146.6K |  2046ms |  ±2.1% |
|                                                                                                                                                | ioredis     |  26.5K |  79.4K |  3776ms |  ±4.3% |
| **Multi-Key: <sup><sub><kbd>MSET</kbd> <kbd>MGET</kbd></sub></sup>**<br/><sub>1 KB</sub>                                                       | **solidis** |  56.6K | 113.2K |  1767ms |  ±5.2% |
|                                                                                                                                                | ioredis     |  30.8K |  61.7K |  3242ms |  ±2.5% |
| **Sorted Set: <sup><sub><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sub></sup>**<br/><sub>1 KB</sub>                                    | **solidis** |  61.0K | 183.0K |  1639ms |  ±1.9% |
|                                                                                                                                                | ioredis     |  33.3K |  99.8K |  3007ms |  ±2.0% |
| **Expire: <sup><sub><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sub></sup>**<br/><sub>1 KB</sub>                                          | **solidis** |  97.8K | 293.4K |  1023ms |  ±5.8% |
|                                                                                                                                                | ioredis     |  54.3K | 163.0K |  1840ms |  ±4.0% |
| **Stream: <sup><sub><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sub></sup>**<br/><sub>1 KB</sub>                                        | **solidis** |  54.6K | 163.9K |  1830ms |  ±2.7% |
|                                                                                                                                                | ioredis     |  30.7K |  92.0K |  3263ms |  ±3.1% |
| **Set: <sup><sub><kbd>SET</kbd></sub></sup>**<br/><sub>1 KB</sub>                                                                              | **solidis** | 135.2K | 135.2K |   740ms |  ±2.6% |
|                                                                                                                                                | ioredis     |  76.6K |  76.6K |  1306ms |  ±1.6% |
| **Hash Round-Trip: <sup><sub><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sub></sup>**<br/><sub>1 KB</sub>                              | **solidis** |  61.3K | 183.8K |  1632ms |  ±6.7% |
|                                                                                                                                                | ioredis     |  37.0K | 111.0K |  2703ms |  ±0.9% |
| **Non-Transaction: <sup><sub><kbd>SETPX</kbd> <kbd>GET</kbd></sub></sup>**<br/><sub>1 KB</sub>                                                 | **solidis** |  92.9K | 185.7K |  1077ms |  ±5.6% |
|                                                                                                                                                | ioredis     |  57.5K | 115.0K |  1739ms |  ±2.6% |
| **Counter: <sup><sub><kbd>INCR</kbd> <kbd>DECR</kbd></sub></sup>**<br/><sub>1 KB</sub>                                                         | **solidis** | 108.5K | 217.1K |   921ms |  ±1.7% |
|                                                                                                                                                | ioredis     |  67.9K | 135.7K |  1474ms |  ±1.6% |
| **Pipeline Mixed: <sup><sub><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sub></sup>**<br/><sub>1 KB</sub>                                    | **solidis** |  59.2K | 177.5K |  1690ms |  ±6.4% |
|                                                                                                                                                | ioredis     |  38.5K | 115.4K |  2600ms |  ±1.5% |
| **Get Buffer: <sup><sub><kbd>GETBUFFER</kbd></sub></sup>**<br/><sub>1 KB</sub>                                                                 | **solidis** | 211.6K | 211.6K |   473ms |  ±7.1% |
|                                                                                                                                                | ioredis     | 139.8K | 139.8K |   716ms |  ±3.9% |

</details>

---

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Gear.png?raw=true" alt="Gear" width="25" height="25" /> Configuration

<details>
<summary>Click to expand benchmark configuration</summary>

| Parameter            | Value               |
| :------------------- | :------------------ |
| Mode                 | `autopipeline`      |
| Payload Sizes        | 1 KB                |
| Iterations           | 100,000             |
| Warmup               | 1,000               |
| Clients              | 1                   |
| Concurrency / Client | 10000               |
| Total Concurrency    | 10000               |
| Repeats              | 10                  |
| Cooldown             | 2500ms              |
| Platform             | linux x64           |
| Node.js              | v22.23.2            |
| Date                 | 2026-09-28 10:33:01 |

</details>

---

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Open%20Book.png?raw=true" alt="Open Book" width="25" height="25" /> Methodology

- Each benchmark is run in an **isolated worker thread** to prevent GC and JIT cross-contamination
- Libraries are **alternated** between repeats to reduce ordering bias
- The Redis server is **flushed and settled** between each benchmark case
- Payloads use a **deterministic pseudo-random pool** shared by both libraries
- Elapsed time is the **median** across all repeat samples
- Spread is the **coefficient of variation** (σ / median × 100%)
- Both clients run with **command timeouts, ready checks and reconnects disabled** and unbounded auto-pipelining

</div>

## Features

<table>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" /> Performance

- `setImmediate` pipeline coalescing
- Linear-time incremental RESP parser
- Zero-copy views for bulk replies of 64KB and more
- Pipelines written as soon as they are built, merged into `writev` by Node

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Electric%20Plug.png?raw=true" alt="Electric Plug" width="25" height="25" /> Protocol

- Full RESP2 + RESP3 wire-level implementation
- All 15 RESP3 reply types (Map, Set, Push, Attribute, BigNumber, ...)
- RESP3 pushes never consume a command reply
- Automatic BigInt promotion for unsafe integers
- Binary-safe: `Buffer` values for string, hash, list and stream writes, `{ buffer: true }` bytes out

</td>
</tr>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Shield.png?raw=true" alt="Shield" width="25" height="25" /> Reliability

- Auto-reconnect with jittered exponential backoff
- Commands wait until the handshake (AUTH, SELECT) is done
- Auto-recovery: AUTH, protocol, SELECT, Pub/Sub subscriptions
- A transaction whose WATCH or MULTI was lost in a reconnect is discarded, not committed
- Command timeout per pipeline or per `send()`; blocking commands get their own
- Ready check (waits for server loading)
- Deterministic in-flight rejection on fault

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Locked.png?raw=true" alt="Locked" width="25" height="25" /> Security

- TLS/SSL (`rediss://` or explicit `tls` option)
- ACL username/password authentication
- Credential masking in debug output
- Error messages add no command arguments and mask the ones the server quotes back
- `maxBulkStringLength` oversized reply guard

</td>
</tr>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/Bullseye.png?raw=true" alt="Bullseye" width="25" height="25" /> Type Safety

- TypeScript `strict` with per-command I/O types
- Mutually exclusive options rejected at compile time
- Runtime reply guards (`tryReplyToString`, ...)
- Structured error hierarchy with standard `cause` chains

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/Puzzle%20Piece.png?raw=true" alt="Puzzle Piece" width="25" height="25" /> Extensibility

- `.extend()` for tree-shakable command composition
- Custom commands with full client `this` binding
- MULTI/EXEC proxy with banned-method enforcement

</td>
</tr>
</table>

## Configuration

<details>
<summary><b>Full options reference</b></summary>

```typescript
const client = new SolidisClient({
  // Connection
  uri: 'redis://user:pass@localhost:6379/0', // redis[s]://[user[:password]@]host[:port][/db]
  host: '127.0.0.1',
  port: 6379,
  tls: { /* tls.ConnectionOptions */ },
  lazyConnect: false,

  // Auth
  authentication: { username: 'user', password: 'pass' },
  database: 0,

  // Protocol & Recovery
  clientName: 'solidis',
  protocol: 'RESP2',                      // 'RESP2' | 'RESP3'
  autoReconnect: true,
  enableReadyCheck: true,
  maxReadyCheckRetries: 100,
  readyCheckInterval: 100,
  maxConnectionRetries: 20,
  connectionRetryDelay: 100,              // doubled after every failed attempt, then jittered to 50–100%
  maxConnectionRetryDelay: 2000,
  autoRecovery: {
    database: true,
    subscribe: true,
    ssubscribe: true,
    psubscribe: true,
  },

  // Timeouts (ms)
  commandTimeout: 5000,                   // 0 disables it; send(commands, { timeout }) overrides it
  connectionTimeout: 2000,

  // Performance
  maxCommandsPerPipeline: 300,
  rejectOnPartialPipelineError: false,

  // Parser
  parser: {
    maxBulkStringLength: 536_870_912,       // 512MB
  },

  // Misc
  maxEventListenersForClient: 10_240,
  debug: false,
  debugMaxEntries: 10_240,
});
```

Explicit options take precedence over the parts of `uri`.

</details>

## Architecture

```mermaid
graph TD
  subgraph SolidisClient
    direction LR
    Conn[Connection<br/><sub>TCP · TLS · Reconnect</sub>]
    Req[Requester<br/><sub>Queue · Pipeline · Timeout</sub>]
    Parse[Parser<br/><sub>RESP2 · RESP3 · Binary-safe</sub>]
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
  Req->>Socket: write pipeline
  Socket-->>Req: RESP reply bytes
  Req-->>Client: parsed reply
  Client-->>App: 'OK'
```

## Events

```typescript
client.on('connect', () => {});                    // TCP connected
client.on('ready', () => {});                      // Handshake done, ready for commands
client.on('close', (error) => {});                 // Connection lost (reconnects when autoReconnect)
client.on('reconnecting', (attempt, delay) => {}); // Before every reconnect attempt
client.on('reconnected', () => {});                // Re-established after disconnect
client.on('end', () => {});                        // Client quit
client.on('error', (error) => {});                 // Non-fatal error (process.emitWarning() without a listener)
client.on('message', (channel, message) => {});    // Pub/Sub message
client.on('pmessage', (pattern, channel, message) => {});
client.on('smessage', (channel, message) => {});   // Shard channel
client.on('push', (reply) => {});                  // Other pushes, such as client tracking invalidations
client.on('debug', (entry) => {});                 // Debug log entry
```

## Error Handling

```typescript
import { RespError, SolidisCommandError, unwrapSolidisError } from '@vcms-io/solidis';

try {
  await client.incr('key');
} catch (error) {
  if (error instanceof SolidisCommandError && error.cause instanceof RespError) {
    console.log(error.cause.code); // 'WRONGTYPE', 'ERR', ...
  }

  const chain = unwrapSolidisError(error); // the error and every cause
}
```

> [!NOTE]
> Every error thrown by Solidis is an instance of `SolidisError` and links its origin through the standard `cause`.
> Messages name the command (`[INCR] ERR ...`) and add none of its arguments. An argument the server quotes back becomes `'***'`, in the message and in its `cause`; a value the server repeats without quotes, such as the coordinates in a GEOADD error or text a script passes to `redis.error_reply()`, stays as the server sent it.
> TS.MADD, BF.MADD and BF.INSERT store items one by one, so they return a rejected item as a `RespError` in their result instead of rejecting the call.

| Error Class              | When                                                                                                                            |
| :----------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| `SolidisCommandError`    | Server error reply (`cause` is the `RespError`), unexpected reply, options a command refuses                                    |
| `SolidisClientError`     | Not ready within `commandTimeout`, a refused handshake (authentication, HELLO, CLIENT SETNAME), quit, a throwing event listener |
| `SolidisConnectionError` | TCP/TLS connect failure, invalid port, timeout, connection lost, retries spent                                                  |
| `SolidisRequesterError`  | Command timeout, a malformed command in `send()`, a refused command such as MONITOR                                             |
| `SolidisParserError`     | Malformed RESP, oversized bulk string or line                                                                                   |
| `SolidisPubSubError`     | Malformed pub/sub event, throwing pub/sub or push listener                                                                      |

## Extensions

```bash
npm install @vcms-io/solidis-extensions
```

| Extension                                                                                                  | Description                                         |
| :--------------------------------------------------------------------------------------------------------- | :-------------------------------------------------- |
| [**SpinLock**](https://github.com/vcms-io/solidis-extensions/blob/main/sources/domains/spinlock/README.md) | Lightweight Redis-backed mutex (single instance)    |
| [**RedLock**](https://github.com/vcms-io/solidis-extensions/blob/main/sources/domains/redlock/README.md)   | Fault-tolerant distributed lock (Redlock algorithm) |

## Contributing

```bash
git clone https://github.com/vcms-io/solidis.git && cd solidis
npm install && npm run build
SOLIDIS_TEST_PORT=6380 npm test # a disposable server: the tests flush it
```

<sub>TypeScript strict · zero new deps · minimal bundle impact · SemVer</sub>

## License

MIT · See [LICENSE](/LICENSE)

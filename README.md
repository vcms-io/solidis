<h1 align="center"><img src="./assets/solidis.png" alt="Solidis" width="50"/></h1>

<h3 align="center">
  <b>The fastest Redis client for Node.js.<br/>Zero dependencies, #1 in all 19 benchmarks, battle-tested in production.</b>
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
> **Need a smaller bundle?** Use `SolidisClient` with `.extend()` to import only the commands you use: **< 29KB** with tree-shaking.

<details>
<summary>&nbsp;&nbsp;<b>Tree-shakable client</b></summary>

<br/>

```typescript
import { SolidisClient } from '@vcms-io/solidis';
import { get } from '@vcms-io/solidis/command/get';
import { set } from '@vcms-io/solidis/command/set';

const client = new SolidisClient({ host: '127.0.0.1', port: 6379 }).extend({ get, set });
```

`extend()` binds the object's own functions to the client.

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

// A timeout for this request only (0 disables it)
const job = await client.send([['BLPOP', 'jobs', '30']], { timeout: 35_000 });
```

- `exec()` sends `MULTI`, the queue and `EXEC` in one `send()` and resolves with the raw replies; queued options such as `{ buffer: true }` do not apply.
- `exec()` rejects when a call queued nothing or `send()` refuses a queued command. Like `discard()`, it then sends `UNWATCH`.
- Only the synchronous part of a queued call joins. A method that awaits its own queued reply never resumes; one that awaits anything else sends the rest outside the transaction. Check arguments before queueing.
- A refused `MULTI` (no `@transaction`) leaves the queue to run alone, and `exec()` rejects with `[MULTI]`.
- After a reconnect loses a `WATCH`, the next `EXEC` becomes `DISCARD` and returns `null`. After it loses a raw `MULTI`, only `MULTI`, `EXEC`, `DISCARD` and `RESET` pass.

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

- Deadline: `commandTimeout` plus the blocking timeout; none when it blocks forever.
- At the deadline the connection resets, so a late reply never reaches another command. A command the server has not run yet may still run and pop a value nobody receives.

</details>

<details>
<summary>&nbsp;&nbsp;<b>Integers beyond 2^53</b></summary>

<br/>

```typescript
const views = await client.incr('views', { bigint: true }); // bigint
```

- INCR, INCRBY, DECR, DECRBY, HINCRBY, BITFIELD and BITFIELD_RO return `number` and reject a result past `Number.MAX_SAFE_INTEGER`. The command has run by then; `cause` holds the exact `bigint`.
- `{ bigint: true }` always returns a `bigint`, and the return type follows.
- INCRBYFLOAT returns a rounded `number`; HINCRBYFLOAT returns the server's exact text.

</details>

<details>
<summary>&nbsp;&nbsp;<b>Binary values</b></summary>

<br/>

```typescript
await client.set('image', Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

const image = await client.get('image', { buffer: true });           // Buffer | null
const images = await client.mget('image', 'logo', { buffer: true }); // (Buffer | null)[]
```

| `Buffer`                     | Commands                                                                                                                                                       |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored as is                 | SET, SETNX, SETEX, PSETEX, GETSET, SETRANGE, APPEND, MSET, MSETNX, HSET, HSETNX, HMSET, LPUSH, RPUSH, LPUSHX, RPUSHX, LSET, XADD, RESTORE                      |
| Compared values              | LINSERT, LREM, LPOS, SMISMEMBER, DELEX, SET                                                                                                                    |
| Other arguments              | PUBLISH, SPUBLISH (message) · BF.LOADCHUNK, CF.LOADCHUNK (chunk) · AUTH, HELLO (credentials) · `send()` (any argument)                                         |
| Read with `{ buffer: true }` | GET, GETDEL, GETEX, GETRANGE, MGET, HGET, HMGET, HGETALL, HVALS, LINDEX, LRANGE, LPOP, RPOP, LMOVE, BLMOVE, RPOPLPUSH, BRPOPLPUSH, BLPOP, BRPOP, LMPOP, BLMPOP |

- A `Buffer` reply is a view of the chunk it arrived in (up to 64 KB). Copy it with `Buffer.from()` to keep it long.
- `send()` copies command arrays, not the `Buffer`s in them: keep a `Buffer` unchanged until its command settles.
- Field names (HGETALL, HSCAN, streams) and RESP3 map keys, also from `send()`, decode as UTF-8, so invalid UTF-8 names can collide. Keep binary data in values.
- MGET and HMGET read a trailing `undefined` as missing options, not as a key.

</details>

<details>
<summary>&nbsp;&nbsp;<b>Mutually exclusive options</b></summary>

<br/>

```typescript
await client.set('key', 'value', { expireInSeconds: 60, setIfKeyNotExists: true });

// Type error: SET accepts one expiration and one condition
await client.set('key', 'value', { expireInSeconds: 60, keepOriginalTimeToLive: true });
```

Option types accept only what the command accepts: one of NX and XX, one of BYSCORE and BYLEX, no WITHSCORES with BYLEX, and so on.

</details>

<details>
<summary>&nbsp;&nbsp;<b>Streams</b></summary>

<br/>

```typescript
const entries = await client.xrange('jobs', '-', '+');
const pending = await client.xpending('jobs', 'workers', '-', '+', 10);
```

- Entry fields form a record: a repeated name keeps its last value, and integer-like names come first in ascending order. `xadd()` takes a record; `send()` returns the raw pairs.
- On RESP3, `xread()` and `xreadgroup()` given one key twice keep only its last result, since a map holds each key once.
- `deliveryTime` is the idle time in `xpending()`, and the Unix time of the last delivery in `xinfoStream(key, true)`, both in milliseconds.

</details>

<br/>

<div id="benchmark">

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Bar%20Chart.png?raw=true" alt="Bar Chart" width="25" height="25" /> Benchmarks

<div align="center">

# <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" /> Solidis vs ioredis, iovalkey, node-redis, valkey-glide and speedkey

<small>Generated on 2026-10-04 23:27:09 · linux x64 · Node.js v22.23.0 · Redis 8.10.2</small>

### Fastest in **19** of **19** benchmarks · **1.5x** the throughput of the next-fastest client on average <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Rocket.png?raw=true" alt="Rocket" width="25" height="25" />

### Leaderboard

|                                                                                                                                                                                        | Client       | Version |  Fastest in | Throughput | CPU per operation |       Peak memory |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------- | :------ | ----------: | ---------: | ----------------: | ----------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **solidis**  | 0.5.0   | **19** / 19 |  **1.00x** |         **1.00x** |         **1.00x** |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | node-redis   | 6.3.0   |      0 / 19 |      0.63x |             1.19x |             0.97x |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | speedkey     | 0.4.2   |      0 / 19 |      0.48x |             1.99x | 0.46x<sup>†</sup> |
|                                                                                                                                                                                     4. | iovalkey     | 0.4.0   |      0 / 19 |      0.39x |             2.30x |             1.51x |
|                                                                                                                                                                                     5. | valkey-glide | 2.5.3   |      0 / 19 |      0.38x |             2.56x | 1.10x<sup>†</sup> |
|                                                                                                                                                                                     6. | ioredis      | 6.0.0   |      0 / 19 |      0.38x |             2.36x |             1.43x |

<sub>Throughput, CPU per operation and peak memory are geometric means over all benchmarks, relative to `solidis` (1.00x). Higher throughput and lower CPU and memory are better.</sub>

<sub><sup>†</sup> Memory the client keeps in native code is not counted.</sub>

### Operations per Second

_100,000 operations × 10,000 concurrency · 1 KB payload · 5 repeats per client_

|                                                                                                                                                                                        | Benchmark                                                                                                          | **solidis** |            ioredis |           iovalkey | node-redis |       valkey-glide |           speedkey |                                                                                                                                                                          Lead                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------- | ----------: | -----------------: | -----------------: | ---------: | -----------------: | -----------------: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup>                                                   |  **417.5K** |              53.1K |              56.0K |      58.1K |  43.9K<sup>1</sup> | 145.8K<sup>1</sup> | **2.9x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | **Transaction Mixed**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup>                                                 |  **135.7K** |              27.9K |              30.4K |      61.5K |  42.2K<sup>2</sup> |              47.0K | **2.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | **Transaction**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup>                                     |  **170.2K** |              35.6K |              39.1K |      77.6K |  67.3K<sup>2</sup> |              55.9K | **2.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
|                                                                                                                                                                                     4. | **Set**<br/><sup><kbd>SET</kbd></sup>                                                                              |  **358.6K** |             144.7K |             151.0K |     216.6K |             115.7K |             173.3K | **1.7x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
|                                                                                                                                                                                     5. | **Set Read**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup>                               |  **158.7K** |              60.0K |              61.0K |     105.4K |  69.9K<sup>3</sup> |  81.8K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     6. | **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup>                                          |  **176.7K** |              74.7K |              74.0K |     118.0K |  81.6K<sup>3</sup> |  93.5K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     7. | **Pipeline Mixed**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup>                                    |  **161.5K** |              72.2K |              72.8K |     110.1K |  73.3K<sup>3</sup> |  84.0K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     8. | **Set Mutation**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup>                               |  **150.6K** |              54.6K |              55.9K |     104.0K |  68.9K<sup>3</sup> |  95.2K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     9. | **Non-Transaction**<br/><sup><kbd>SETPX</kbd> <kbd>GET</kbd></sup>                                                 |  **199.1K** |              85.0K |              85.4K |     139.5K |  84.8K<sup>3</sup> | 105.1K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    10. | **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup>                                    |  **135.8K** |              58.5K |              58.6K |      96.6K |  60.3K<sup>3</sup> |  67.9K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    11. | **Hash Mutation**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup>                                 |  **129.7K** |              56.4K |              57.4K |      92.6K |  50.8K<sup>3</sup> |  62.3K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    12. | **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup>                                                       |  **146.6K** |              62.7K |              67.8K |     104.9K |  62.9K<sup>3</sup> |  73.2K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    13. | **List Range**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup>                                  |  **129.1K** |              54.8K |              56.4K |      93.2K |  59.0K<sup>3</sup> |  74.0K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    14. | **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup>                                                         |  **256.4K** |             122.3K |             126.9K |     188.4K | 105.6K<sup>3</sup> | 134.6K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    15. | **Hash Round-Trip**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup>                              |  **139.9K** |              67.3K |              70.7K |     106.4K |  60.1K<sup>3</sup> |  69.0K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    16. | **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIGGET</kbd></sup>                                              |  **221.2K** | 111.7K<sup>4</sup> | 114.3K<sup>4</sup> |     169.6K |  89.9K<sup>3</sup> |  94.7K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    17. | **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup>                                        |  **138.6K** |              57.7K |              59.6K |     106.8K |  53.6K<sup>3</sup> |  55.7K<sup>3</sup> |                                                                           **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    18. | **List Mutation**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup> |  **108.6K** |              41.6K |              41.8K |      90.3K |  49.3K<sup>3</sup> |  57.5K<sup>3</sup> |                                                                           **1.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    19. | **Get**<br/><sup><kbd>GET</kbd></sup>                                                                              |  **337.7K** |             194.5K |             193.7K |     303.7K |             113.3K |             193.3K |                                                                           **1.1x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |

<sub>Median operations per second over the repeats; the fastest client of each benchmark is in bold. Lead = `solidis` ÷ the fastest other client.</sub>

<sub><sup>1</sup> Subscribes over RESP3, which it requires for Pub/Sub</sub><br/>
<sub><sup>2</sup> Does not take MULTI and EXEC in a batch, so it sends the commands between them as an atomic batch</sub><br/>
<sub><sup>3</sup> Does not keep the order of concurrent commands, so it sends each operation as one batch</sub><br/>
<sub><sup>4</sup> Does not auto-pipeline INFO</sub>

</div>

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Bar%20Chart.png?raw=true" alt="Bar Chart" width="25" height="25" /> Detailed Metrics

<sub>Per library: operations and commands per second, latency (p50 / p95 / p99 / p99.9), CPU and GC time per operation, peak memory and spread.</sub>

<details>
<summary>Click to expand the detailed metrics</summary>

| Benchmark                                                                                                                              | Library                  |  ops/s | cmds/s |      p50 |      p95 |      p99 |    p99.9 |  CPU/op |  GC/op |               Memory | Spread |
| :------------------------------------------------------------------------------------------------------------------------------------- | :----------------------- | -----: | -----: | -------: | -------: | -------: | -------: | ------: | -----: | -------------------: | -----: |
| **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup><br/><sub>1 KB</sub>                                                   | **solidis**              | 417.5K | 417.5K |   4.96ms |  10.27ms |  26.44ms |  29.96ms |  3.69µs | 0.23µs |              24.2 MB |  ±1.3% |
|                                                                                                                                        | ioredis                  |  53.1K |  53.1K |  44.06ms |  68.07ms |  75.53ms |  88.93ms | 24.45µs | 1.81µs |             144.2 MB |  ±1.1% |
|                                                                                                                                        | iovalkey                 |  56.0K |  56.0K |  43.02ms |  64.05ms |  68.85ms |  78.33ms | 23.47µs | 1.90µs |             155.2 MB |  ±0.9% |
|                                                                                                                                        | node-redis               |  58.1K |  58.1K |  37.40ms |  64.54ms |  70.38ms |  79.49ms | 18.96µs | 1.85µs |              79.7 MB |  ±0.8% |
|                                                                                                                                        | valkey-glide<sup>1</sup> |  43.9K |  43.9K |  51.15ms |  81.31ms |  85.22ms |  90.88ms | 55.88µs | 1.93µs | 128.6 MB<sup>†</sup> |  ±0.8% |
|                                                                                                                                        | speedkey<sup>1</sup>     | 145.8K | 145.8K |  14.48ms |  21.78ms |  28.31ms |  32.42ms | 15.82µs | 0.57µs |  21.3 MB<sup>†</sup> |  ±4.6% |
| **Transaction Mixed**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                 | **solidis**              | 135.7K | 814.5K |  68.93ms |  99.09ms | 119.42ms | 128.27ms | 16.84µs | 2.05µs |             355.5 MB |  ±0.9% |
|                                                                                                                                        | ioredis                  |  27.9K | 167.7K | 351.02ms | 378.23ms | 385.29ms | 390.82ms | 59.53µs | 6.38µs |             676.4 MB |  ±1.4% |
|                                                                                                                                        | iovalkey                 |  30.4K | 182.4K | 323.21ms | 350.36ms | 368.03ms | 372.39ms | 56.81µs | 7.08µs |             715.4 MB |  ±1.4% |
|                                                                                                                                        | node-redis               |  61.5K | 368.9K | 158.00ms | 187.25ms | 192.70ms | 198.00ms | 30.48µs | 4.13µs |             492.7 MB |  ±1.7% |
|                                                                                                                                        | valkey-glide<sup>2</sup> |  42.2K | 253.5K | 233.14ms | 254.52ms | 271.97ms | 279.47ms | 53.07µs | 7.64µs | 360.1 MB<sup>†</sup> |  ±0.9% |
|                                                                                                                                        | speedkey                 |  47.0K | 281.9K | 208.67ms | 241.19ms | 253.41ms | 256.57ms | 43.09µs | 0.00µs | 216.4 MB<sup>†</sup> |  ±1.4% |
| **Transaction**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                     | **solidis**              | 170.2K | 850.8K |  52.88ms |  98.70ms | 114.76ms | 119.78ms | 12.26µs | 1.69µs |             276.7 MB |  ±1.4% |
|                                                                                                                                        | ioredis                  |  35.6K | 178.0K | 274.66ms | 296.69ms | 305.72ms | 319.44ms | 45.90µs | 5.41µs |             620.1 MB |  ±1.2% |
|                                                                                                                                        | iovalkey                 |  39.1K | 195.7K | 250.26ms | 276.46ms | 286.39ms | 298.10ms | 44.36µs | 6.02µs |             657.4 MB |  ±1.7% |
|                                                                                                                                        | node-redis               |  77.6K | 387.9K | 122.85ms | 146.93ms | 160.35ms | 162.97ms | 25.17µs | 3.60µs |             525.1 MB |  ±2.5% |
|                                                                                                                                        | valkey-glide<sup>2</sup> |  67.3K | 336.5K | 139.25ms | 165.90ms | 178.64ms | 197.75ms | 32.16µs | 5.31µs | 379.4 MB<sup>†</sup> |  ±2.7% |
|                                                                                                                                        | speedkey                 |  55.9K | 279.4K | 173.86ms | 205.76ms | 211.22ms | 215.61ms | 35.91µs | 0.00µs | 204.3 MB<sup>†</sup> |  ±1.2% |
| **Set**<br/><sup><kbd>SET</kbd></sup><br/><sub>1 KB</sub>                                                                              | **solidis**              | 358.6K | 358.6K |  25.11ms |  49.14ms |  56.68ms |  61.17ms |  6.58µs | 1.04µs |             180.1 MB |  ±5.5% |
|                                                                                                                                        | ioredis                  | 144.7K | 144.7K |  64.02ms |  94.34ms | 104.65ms | 106.63ms | 13.28µs | 1.95µs |             305.6 MB |  ±2.5% |
|                                                                                                                                        | iovalkey                 | 151.0K | 151.0K |  61.52ms |  87.32ms |  94.63ms |  99.31ms | 12.79µs | 1.98µs |             273.9 MB |  ±1.6% |
|                                                                                                                                        | node-redis               | 216.6K | 216.6K |  43.03ms |  50.23ms |  53.87ms |  57.25ms |  8.03µs | 1.66µs |             178.3 MB |  ±1.6% |
|                                                                                                                                        | valkey-glide             | 115.7K | 115.7K |  82.33ms |  91.01ms |  96.02ms | 100.27ms | 18.30µs | 2.00µs | 214.6 MB<sup>†</sup> |  ±1.9% |
|                                                                                                                                        | speedkey                 | 173.3K | 173.3K |  54.91ms |  74.54ms |  86.03ms |  91.03ms | 14.68µs | 1.04µs | 159.5 MB<sup>†</sup> |  ±2.7% |
| **Set Read**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              | 158.7K | 476.1K |  58.89ms |  87.92ms | 108.85ms | 113.56ms | 14.14µs | 2.08µs |             326.5 MB |  ±1.3% |
|                                                                                                                                        | ioredis                  |  60.0K | 180.1K | 162.49ms | 195.03ms | 200.82ms | 201.94ms | 35.42µs | 4.64µs |             392.1 MB |  ±0.7% |
|                                                                                                                                        | iovalkey                 |  61.0K | 182.9K | 160.00ms | 194.25ms | 205.02ms | 206.94ms | 35.28µs | 4.81µs |             397.6 MB |  ±1.0% |
|                                                                                                                                        | node-redis               | 105.4K | 316.1K |  92.80ms | 104.53ms | 119.27ms | 120.02ms | 15.00µs | 3.13µs |             275.7 MB |  ±2.8% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  69.9K | 209.7K | 137.62ms | 155.44ms | 159.11ms | 165.07ms | 30.78µs | 5.03µs | 319.6 MB<sup>†</sup> |  ±0.8% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  81.8K | 245.4K | 117.15ms | 130.63ms | 141.41ms | 144.26ms | 25.36µs | 0.00µs |  78.6 MB<sup>†</sup> |  ±1.0% |
| **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup><br/><sub>1 KB</sub>                                          | **solidis**              | 176.7K | 530.0K |  51.16ms |  80.24ms |  91.85ms | 107.47ms | 12.51µs | 1.98µs |             312.7 MB |  ±2.9% |
|                                                                                                                                        | ioredis                  |  74.7K | 224.2K | 130.79ms | 157.44ms | 164.98ms | 168.87ms | 25.15µs | 3.95µs |             461.6 MB |  ±2.6% |
|                                                                                                                                        | iovalkey                 |  74.0K | 222.1K | 131.67ms | 150.55ms | 154.16ms | 157.16ms | 25.59µs | 4.21µs |             484.9 MB |  ±1.5% |
|                                                                                                                                        | node-redis               | 118.0K | 354.0K |  80.98ms |  95.03ms | 101.86ms | 104.23ms | 13.27µs | 3.20µs |             241.6 MB |  ±3.1% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  81.6K | 244.9K | 117.21ms | 135.03ms | 142.10ms | 147.35ms | 25.29µs | 4.82µs | 409.2 MB<sup>†</sup> |  ±1.7% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  93.5K | 280.5K | 105.60ms | 116.26ms | 122.01ms | 130.82ms | 22.40µs | 0.00µs | 122.8 MB<sup>†</sup> |  ±1.6% |
| **Pipeline Mixed**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              | 161.5K | 484.4K |  58.28ms |  92.04ms | 104.72ms | 106.67ms | 14.29µs | 2.15µs |             325.5 MB |  ±4.0% |
|                                                                                                                                        | ioredis                  |  72.2K | 216.5K | 136.18ms | 161.47ms | 166.25ms | 170.67ms | 28.40µs | 4.21µs |             499.7 MB |  ±2.5% |
|                                                                                                                                        | iovalkey                 |  72.8K | 218.3K | 132.79ms | 163.48ms | 169.06ms | 171.66ms | 28.09µs | 4.36µs |             522.3 MB |  ±3.1% |
|                                                                                                                                        | node-redis               | 110.1K | 330.2K |  87.98ms | 103.89ms | 110.30ms | 112.65ms | 14.37µs | 3.19µs |             276.8 MB |  ±2.6% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  73.3K | 219.8K | 128.31ms | 152.07ms | 155.69ms | 160.27ms | 28.82µs | 5.00µs | 340.4 MB<sup>†</sup> |  ±0.8% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  84.0K | 251.9K | 115.61ms | 125.29ms | 133.46ms | 142.15ms | 25.20µs | 0.00µs |  76.5 MB<sup>†</sup> |  ±0.7% |
| **Set Mutation**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              | 150.6K | 451.8K |  58.57ms | 103.64ms | 124.93ms | 133.37ms | 15.49µs | 2.31µs |             289.9 MB |  ±3.1% |
|                                                                                                                                        | ioredis                  |  54.6K | 163.7K | 185.32ms | 200.61ms | 212.06ms | 214.32ms | 36.16µs | 4.95µs |             188.3 MB |  ±1.1% |
|                                                                                                                                        | iovalkey                 |  55.9K | 167.8K | 169.56ms | 195.54ms | 204.68ms | 205.97ms | 37.66µs | 4.81µs |             276.7 MB |  ±7.6% |
|                                                                                                                                        | node-redis               | 104.0K | 311.9K |  94.01ms | 109.10ms | 116.42ms | 121.85ms | 14.56µs | 3.14µs |             227.6 MB |  ±2.8% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  68.9K | 206.7K | 139.75ms | 160.74ms | 169.06ms | 175.29ms | 30.09µs | 5.11µs | 343.0 MB<sup>†</sup> |  ±1.7% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  95.2K | 285.5K | 103.68ms | 113.75ms | 116.57ms | 118.43ms | 22.25µs | 0.00µs |  89.1 MB<sup>†</sup> |  ±2.3% |
| **Non-Transaction**<br/><sup><kbd>SETPX</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                 | **solidis**              | 199.1K | 398.3K |  45.58ms |  79.14ms |  92.98ms | 101.02ms | 11.42µs | 1.61µs |             272.7 MB |  ±2.0% |
|                                                                                                                                        | ioredis                  |  85.0K | 170.0K | 113.46ms | 140.56ms | 160.52ms | 161.72ms | 23.13µs | 3.18µs |             384.6 MB |  ±2.0% |
|                                                                                                                                        | iovalkey                 |  85.4K | 170.8K | 112.20ms | 135.43ms | 143.84ms | 146.62ms | 22.25µs | 3.29µs |             418.8 MB |  ±2.6% |
|                                                                                                                                        | node-redis               | 139.5K | 279.1K |  68.63ms |  81.04ms |  87.25ms |  98.01ms | 11.61µs | 2.53µs |             223.3 MB |  ±4.1% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  84.8K | 169.6K | 109.44ms | 127.99ms | 132.94ms | 138.93ms | 25.73µs | 4.19µs | 311.0 MB<sup>†</sup> |  ±0.8% |
|                                                                                                                                        | speedkey<sup>3</sup>     | 105.1K | 210.3K |  92.88ms | 100.91ms | 106.13ms | 109.33ms | 20.42µs | 0.00µs | 195.2 MB<sup>†</sup> |  ±1.1% |
| **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              | 135.8K | 407.4K |  67.59ms |  97.25ms | 115.33ms | 122.95ms | 16.53µs | 2.41µs |             405.3 MB |  ±2.0% |
|                                                                                                                                        | ioredis                  |  58.5K | 175.4K | 166.70ms | 191.91ms | 217.62ms | 221.37ms | 36.57µs | 4.53µs |             377.2 MB |  ±1.5% |
|                                                                                                                                        | iovalkey                 |  58.6K | 175.8K | 165.14ms | 196.37ms | 207.60ms | 212.51ms | 36.34µs | 4.81µs |             383.7 MB |  ±1.9% |
|                                                                                                                                        | node-redis               |  96.6K | 289.9K |  99.77ms | 119.96ms | 126.33ms | 128.94ms | 16.58µs | 3.38µs |             330.0 MB |  ±0.9% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  60.3K | 180.9K | 158.49ms | 184.47ms | 189.25ms | 191.33ms | 35.13µs | 5.88µs | 349.9 MB<sup>†</sup> |  ±0.7% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  67.9K | 203.7K | 143.45ms | 166.81ms | 182.60ms | 186.57ms | 29.63µs | 0.00µs | 205.5 MB<sup>†</sup> |  ±2.7% |
| **Hash Mutation**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup><br/><sub>1 KB</sub>                                 | **solidis**              | 129.7K | 389.0K |  69.61ms | 101.08ms | 115.97ms | 122.42ms | 17.89µs | 2.21µs |             395.9 MB |  ±1.2% |
|                                                                                                                                        | ioredis                  |  56.4K | 169.1K | 177.42ms | 204.60ms | 214.29ms | 222.56ms | 44.45µs | 4.93µs |             455.4 MB |  ±1.7% |
|                                                                                                                                        | iovalkey                 |  57.4K | 172.2K | 174.74ms | 195.80ms | 204.24ms | 208.57ms | 43.87µs | 5.32µs |             429.1 MB |  ±2.3% |
|                                                                                                                                        | node-redis               |  92.6K | 277.9K | 104.29ms | 121.05ms | 127.62ms | 129.41ms | 17.89µs | 3.29µs |             320.9 MB |  ±2.2% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  50.8K | 152.5K | 188.32ms | 216.73ms | 223.24ms | 228.87ms | 41.77µs | 6.47µs | 335.3 MB<sup>†</sup> |  ±2.7% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  62.3K | 186.8K | 155.32ms | 179.84ms | 185.87ms | 189.20ms | 31.89µs | 0.00µs | 191.3 MB<sup>†</sup> |  ±0.6% |
| **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup><br/><sub>1 KB</sub>                                                       | **solidis**              | 146.6K | 293.2K |  64.87ms |  86.66ms | 102.64ms | 106.84ms | 15.51µs | 1.84µs |             351.0 MB |  ±4.6% |
|                                                                                                                                        | ioredis                  |  62.7K | 125.4K | 159.44ms | 180.37ms | 186.73ms | 187.89ms | 38.68µs | 4.27µs |             403.0 MB |  ±2.7% |
|                                                                                                                                        | iovalkey                 |  67.8K | 135.6K | 146.55ms | 177.02ms | 183.04ms | 187.39ms | 31.93µs | 3.88µs |             449.1 MB |  ±2.1% |
|                                                                                                                                        | node-redis               | 104.9K | 209.8K |  91.93ms | 103.36ms | 107.35ms | 110.32ms | 16.35µs | 2.75µs |             311.8 MB |  ±1.9% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  62.9K | 125.8K | 153.11ms | 169.49ms | 174.12ms | 179.28ms | 35.73µs | 4.73µs | 269.9 MB<sup>†</sup> |  ±0.8% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  73.2K | 146.3K | 131.30ms | 159.37ms | 167.69ms | 174.75ms | 27.41µs | 0.00µs | 170.8 MB<sup>†</sup> |  ±2.0% |
| **List Range**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup><br/><sub>1 KB</sub>                                  | **solidis**              | 129.1K | 387.4K |  69.48ms | 104.96ms | 111.58ms | 117.81ms | 17.98µs | 2.38µs |             410.4 MB |  ±2.4% |
|                                                                                                                                        | ioredis                  |  54.8K | 164.5K | 180.49ms | 205.11ms | 223.00ms | 230.01ms | 45.18µs | 5.18µs |             447.3 MB |  ±2.4% |
|                                                                                                                                        | iovalkey                 |  56.4K | 169.1K | 175.08ms | 197.98ms | 204.19ms | 206.38ms | 42.87µs | 5.16µs |             425.8 MB |  ±2.6% |
|                                                                                                                                        | node-redis               |  93.2K | 279.5K | 102.98ms | 120.83ms | 131.61ms | 138.21ms | 17.52µs | 3.29µs |             318.7 MB |  ±1.8% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  59.0K | 177.0K | 161.20ms | 186.00ms | 190.10ms | 194.73ms | 38.07µs | 5.54µs | 302.0 MB<sup>†</sup> |  ±0.8% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  74.0K | 221.9K | 131.92ms | 159.68ms | 164.41ms | 167.16ms | 28.28µs | 0.00µs | 180.1 MB<sup>†</sup> |  ±2.3% |
| **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup><br/><sub>1 KB</sub>                                                         | **solidis**              | 256.4K | 512.7K |  35.11ms |  54.29ms |  62.54ms |  66.64ms |  9.76µs | 1.62µs |             250.4 MB |  ±3.9% |
|                                                                                                                                        | ioredis                  | 122.3K | 244.6K |  74.38ms | 116.69ms | 122.45ms | 126.35ms | 17.23µs | 3.04µs |             347.4 MB |  ±3.9% |
|                                                                                                                                        | iovalkey                 | 126.9K | 253.9K |  71.76ms | 112.54ms | 116.53ms | 120.67ms | 17.11µs | 3.07µs |             375.9 MB |  ±2.3% |
|                                                                                                                                        | node-redis               | 188.4K | 376.8K |  49.72ms |  65.01ms |  69.98ms |  72.57ms |  9.37µs | 2.43µs |             220.7 MB |  ±1.8% |
|                                                                                                                                        | valkey-glide<sup>3</sup> | 105.6K | 211.2K |  89.12ms | 117.34ms | 128.92ms | 141.00ms | 22.13µs | 3.66µs | 377.4 MB<sup>†</sup> |  ±2.4% |
|                                                                                                                                        | speedkey<sup>3</sup>     | 134.6K | 269.1K |  70.86ms |  81.26ms |  88.83ms |  93.72ms | 16.75µs | 0.00µs |  45.9 MB<sup>†</sup> |  ±1.2% |
| **Hash Round-Trip**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup><br/><sub>1 KB</sub>                              | **solidis**              | 139.9K | 419.7K |  65.34ms |  91.66ms | 110.34ms | 123.69ms | 16.79µs | 2.22µs |             374.4 MB |  ±3.6% |
|                                                                                                                                        | ioredis                  |  67.3K | 201.8K | 142.93ms | 178.37ms | 183.91ms | 188.00ms | 31.34µs | 4.24µs |             491.0 MB |  ±3.4% |
|                                                                                                                                        | iovalkey                 |  70.7K | 212.1K | 136.68ms | 167.16ms | 194.45ms | 204.77ms | 31.74µs | 4.61µs |             505.6 MB |  ±3.7% |
|                                                                                                                                        | node-redis               | 106.4K | 319.1K |  91.65ms | 109.76ms | 114.65ms | 119.09ms | 16.11µs | 3.27µs |             341.6 MB |  ±3.5% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  60.1K | 180.4K | 157.43ms | 187.25ms | 192.14ms | 196.41ms | 35.23µs | 5.64µs | 327.0 MB<sup>†</sup> |  ±2.6% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  69.0K | 207.0K | 138.74ms | 164.27ms | 167.02ms | 169.60ms | 30.48µs | 0.00µs | 167.0 MB<sup>†</sup> |  ±2.1% |
| **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIGGET</kbd></sup><br/><sub>1 KB</sub>                                              | **solidis**              | 221.2K | 442.5K |  39.92ms |  72.78ms |  87.85ms |  96.08ms | 10.94µs | 1.69µs |             287.1 MB |  ±2.8% |
|                                                                                                                                        | ioredis<sup>4</sup>      | 111.7K | 223.3K |  83.55ms | 123.31ms | 128.99ms | 133.21ms | 16.95µs | 2.24µs |             278.0 MB |  ±1.7% |
|                                                                                                                                        | iovalkey<sup>4</sup>     | 114.3K | 228.5K |  79.61ms | 119.15ms | 124.82ms | 130.07ms | 17.10µs | 2.46µs |             308.4 MB |  ±1.6% |
|                                                                                                                                        | node-redis               | 169.6K | 339.2K |  54.51ms |  73.40ms |  80.89ms |  85.73ms | 10.94µs | 2.39µs |             248.2 MB |  ±1.9% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  89.9K | 179.7K | 101.29ms | 142.54ms | 160.12ms | 165.78ms | 26.16µs | 4.25µs | 380.3 MB<sup>†</sup> |  ±2.1% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  94.7K | 189.3K | 102.92ms | 118.38ms | 123.10ms | 126.22ms | 21.52µs | 0.00µs | 233.5 MB<sup>†</sup> |  ±1.1% |
| **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup><br/><sub>1 KB</sub>                                        | **solidis**              | 138.6K | 415.9K |  67.12ms |  95.89ms | 114.17ms | 120.31ms | 16.02µs | 2.41µs |             396.2 MB |  ±2.2% |
|                                                                                                                                        | ioredis                  |  57.7K | 173.0K | 169.91ms | 191.79ms | 195.88ms | 199.37ms | 32.78µs | 4.38µs |             455.3 MB |  ±1.7% |
|                                                                                                                                        | iovalkey                 |  59.6K | 178.8K | 164.89ms | 188.04ms | 191.75ms | 193.13ms | 30.59µs | 4.60µs |             495.8 MB |  ±1.0% |
|                                                                                                                                        | node-redis               | 106.8K | 320.5K |  90.33ms | 104.94ms | 109.48ms | 115.20ms | 15.16µs | 3.40µs |             330.1 MB |  ±1.5% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  53.6K | 160.7K | 173.50ms | 212.92ms | 220.80ms | 223.60ms | 39.15µs | 6.36µs | 391.5 MB<sup>†</sup> |  ±1.5% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  55.7K | 167.1K | 174.89ms | 202.00ms | 211.53ms | 214.93ms | 35.60µs | 0.00µs | 207.0 MB<sup>†</sup> |  ±1.8% |
| **List Mutation**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup><br/><sub>1 KB</sub> | **solidis**              | 108.6K | 542.9K |  86.13ms | 119.68ms | 152.21ms | 167.19ms | 21.64µs | 3.16µs |             417.3 MB |  ±1.5% |
|                                                                                                                                        | ioredis                  |  41.6K | 207.8K | 243.81ms | 266.02ms | 286.00ms | 293.12ms | 56.88µs | 8.16µs |             521.1 MB |  ±2.9% |
|                                                                                                                                        | iovalkey                 |  41.8K | 208.8K | 241.55ms | 257.17ms | 263.68ms | 265.03ms | 55.86µs | 8.43µs |             539.5 MB |  ±1.2% |
|                                                                                                                                        | node-redis               |  90.3K | 451.6K | 104.91ms | 129.15ms | 138.29ms | 150.48ms | 20.21µs | 2.25µs |             359.3 MB |  ±1.6% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  49.3K | 246.6K | 198.86ms | 222.67ms | 229.10ms | 235.09ms | 43.28µs | 6.85µs | 341.7 MB<sup>†</sup> |  ±1.8% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  57.5K | 287.6K | 168.30ms | 187.84ms | 192.95ms | 194.78ms | 36.08µs | 0.00µs | 103.6 MB<sup>†</sup> |  ±1.1% |
| **Get**<br/><sup><kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                                              | **solidis**              | 337.7K | 337.7K |  27.16ms |  38.90ms |  51.52ms |  58.54ms |  6.45µs | 0.86µs |             117.2 MB |  ±3.3% |
|                                                                                                                                        | ioredis                  | 194.5K | 194.5K |  47.05ms |  74.78ms |  85.28ms |  90.09ms | 10.23µs | 1.63µs |             277.6 MB |  ±2.9% |
|                                                                                                                                        | iovalkey                 | 193.7K | 193.7K |  47.18ms |  76.83ms |  87.73ms |  94.95ms | 10.33µs | 1.72µs |             294.3 MB |  ±1.2% |
|                                                                                                                                        | node-redis               | 303.7K | 303.7K |  28.77ms |  43.36ms |  48.32ms |  50.53ms |  7.73µs | 1.06µs |              88.8 MB |  ±4.6% |
|                                                                                                                                        | valkey-glide             | 113.3K | 113.3K |  81.51ms | 134.61ms | 157.17ms | 164.19ms | 19.90µs | 1.22µs |  82.9 MB<sup>†</sup> |  ±2.0% |
|                                                                                                                                        | speedkey                 | 193.3K | 193.3K |  49.17ms |  61.87ms |  69.05ms |  74.57ms | 15.04µs | 1.07µs |   0.0 MB<sup>†</sup> |  ±1.9% |

<sub><sup>†</sup> Memory the client keeps in native code is not counted.</sub>

</details>

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Gear.png?raw=true" alt="Gear" width="25" height="25" /> Environment and Configuration

<details>
<summary>Click to expand the environment and configuration</summary>

| Parameter                  | Value                                                                                              |
| :------------------------- | :------------------------------------------------------------------------------------------------- |
| CPU                        | 12th Gen Intel(R) Core(TM) i9-12900K (10 threads)                                                  |
| Memory                     | 9.7 GB                                                                                             |
| Operating system           | linux x64 (5.15.133.1-microsoft-standard-WSL2)                                                     |
| Node.js                    | v22.23.0                                                                                           |
| Server                     | Redis 8.10.2                                                                                       |
| Clients                    | solidis 0.5.0, ioredis 6.0.0, iovalkey 0.4.0, node-redis 6.3.0, valkey-glide 2.5.3, speedkey 0.4.2 |
| Mode                       | `autopipeline`                                                                                     |
| Payload sizes              | 1 KB                                                                                               |
| Operations per sample      | 100,000                                                                                            |
| Warmup operations          | 1,000                                                                                              |
| Connections per client     | 1                                                                                                  |
| Concurrency per connection | 10000                                                                                              |
| Repeats                    | 5                                                                                                  |
| Cooldown                   | 300ms                                                                                              |
| Date                       | 2026-10-04 23:27:09                                                                                |

</details>

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Open%20Book.png?raw=true" alt="Open Book" width="25" height="25" /> Methodology

- Every sample runs in its own **worker thread**, so garbage collection and JIT state never carry over.
- The library order **rotates** per sample, and the server is **flushed and settled** before each one.
- All libraries get the same **deterministic binary payloads**, and every reply is checked after the measured phase.
- Throughput is the **median** of the repeats; spread is σ / median.
- Latency is timed **per operation** at the configured concurrency, over all repeats.
- CPU/op is the **process CPU time** (user + system) of the measured phase per operation, so it includes garbage collection and native threads. GC/op is the garbage-collection pause time, divided the same way.
- Memory is the largest growth of the worker's heap plus `ArrayBuffer` memory (all `Buffer`s) during the measured phase, sampled every 20 ms; memory held by native code is not counted. Replies are kept until checked, as an application would.
- Clients run with **timeouts, ready checks and reconnects off** and no pipelining limit. ioredis and iovalkey auto-pipeline; Valkey GLIDE and speedkey decode replies as bytes over RESP2.
- A result whose client could not run a benchmark the same way is **numbered** and explained below the table.
- Compared: every Node.js TCP client with 1,000+ weekly npm downloads that installs without compiling and keeps binary values. Left out: redis-fast-driver (native build), tedis (string values), HTTP clients such as @upstash/redis, and forks or wrappers. Valkey GLIDE has no Windows build.

</div>

## Features

<table>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" /> Performance

- `setImmediate` pipeline coalescing
- Linear-time incremental RESP parser
- Zero-copy views for bulk replies
- Pipelines go out as soon as they are built; Node merges them into `writev`

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Electric%20Plug.png?raw=true" alt="Electric Plug" width="25" height="25" /> Protocol

- RESP2 and RESP3, except streamed replies, which Redis and Valkey never send
- All 15 RESP3 reply types (Map, Set, Push, Attribute, BigNumber, ...)
- RESP3 pushes never take a command's reply
- `bigint` past 2^53: automatic in raw replies, `{ bigint: true }` for commands
- Binary-safe: `Buffer` values in, `{ buffer: true }` bytes out

</td>
</tr>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Shield.png?raw=true" alt="Shield" width="25" height="25" /> Reliability

- Auto-reconnect with jittered exponential backoff
- Commands wait for the handshake (AUTH, SELECT)
- Restores AUTH, protocol, SELECT and subscriptions
- Discards a transaction whose WATCH or MULTI a reconnect lost
- Timeouts per pipeline or per `send()`; blocking commands get their own
- Ready check that waits for the server to load
- Deterministic rejection of in-flight commands on faults

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Locked.png?raw=true" alt="Locked" width="25" height="25" /> Security

- TLS (`rediss://` or the `tls` option)
- ACL username and password
- Debug entries name commands, never their arguments
- Error messages mask the arguments the server quotes back
- `maxBulkStringLength` guard and a 512-level nesting limit

</td>
</tr>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/Bullseye.png?raw=true" alt="Bullseye" width="25" height="25" /> Type Safety

- TypeScript `strict` with per-command types
- Mutually exclusive options fail at compile time
- Runtime reply guards (`tryReplyToString`, ...)
- Error classes linked by the standard `cause`

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/Puzzle%20Piece.png?raw=true" alt="Puzzle Piece" width="25" height="25" /> Extensibility

- `.extend()` for tree-shakable commands
- Custom commands bound to the client
- Transactions that offer commands only

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
  authentication: { username: 'user', password: 'pass' }, // an empty username means the default user
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
});
```

Explicit options override the parts of `uri`.

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

| Module         | Responsibility                                      |
| :------------- | :-------------------------------------------------- |
| **Connection** | TCP/TLS socket, reconnect backoff                   |
| **Requester**  | Queue, pipeline chunking, reply matching, timeouts  |
| **Parser**     | Incremental, binary-safe RESP decoding              |
| **PubSub**     | Channel, pattern and shard state, message dispatch  |
| **Debug**      | `debug` entries that name commands, never arguments |

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

| Error class              | When                                                                              |
| :----------------------- | :-------------------------------------------------------------------------------- |
| `SolidisCommandError`    | Server error (`cause` is the `RespError`), unexpected reply, refused options      |
| `SolidisClientError`     | Not ready in time, refused handshake, quit, throwing event listener               |
| `SolidisConnectionError` | Connect failure or timeout, invalid port, lost connection, retries spent, refusal |
| `SolidisRequesterError`  | Command timeout, malformed `send()` command, refused command such as MONITOR      |
| `SolidisParserError`     | Malformed RESP, oversized bulk string or line, nesting past 512 levels            |
| `SolidisPubSubError`     | Malformed Pub/Sub event, throwing Pub/Sub or push listener                        |

> [!NOTE]
>
> - Errors for arguments of the declared types are `SolidisError`s linked by the standard `cause`.
> - Messages name the command (`[INCR] ERR ...`), never its arguments. A quoted argument becomes `'***'` in the message and in `cause`. Unquoted echoes stay: GEOADD coordinates, `redis.error_reply()` text, a FUNCTION LOAD library name.
> - Messages longer than 4,096 characters are cut; a quoted argument the cut leaves open is masked to the end.
> - Arguments are checked by declared type only. From JavaScript, a string for an array, an array for an object or ioredis-style `set(key, value, 'EX', 10)` builds a different command. Field records accept objects only.
> - ESM and CJS clients and commands mix, but each build has its own error classes, so `instanceof` matches its own build only.
> - TS.MADD, BF.MADD and BF.INSERT return a rejected item as a `RespError` in their result.

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
npm run lint:check # lint, formatting and the type tests
SOLIDIS_TEST_PORT=6380 npm test # a disposable server: the tests flush it
```

<sub>TypeScript strict · zero new deps · minimal bundle impact · SemVer</sub>

## License

MIT · See [LICENSE](/LICENSE)

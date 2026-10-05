<h1 align="center"><img src="./assets/solidis.png" alt="Solidis" width="50"/></h1>

<h3 align="center">
  <b>The fastest Redis client for Node.js.<br/>Zero dependencies, battle-tested in production.</b>
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

// A timeout for one request (0 disables it), and a raw blocking command handled like blpop()
await client.send([['INFO']], { timeout: 1_000 });
const job = await client.send([['BLPOP', 'jobs', '30']], { blockingTimeout: 30_000 });
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
- `send()` handles a raw blocking command the same way when you pass its timeout in milliseconds as `blockingTimeout`; `0` means it blocks forever.

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
- Stream reads, HSCAN and HRANDFIELD return values as UTF-8 strings; read binary values from them with `send()`.
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

<small>Generated on 2026-10-05 02:30:21 · linux x64 · Node.js v22.23.0 · Redis 8.10.2</small>

### Fastest in **19** of **19** benchmarks · **1.5x** the throughput of the next-fastest client on average <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Rocket.png?raw=true" alt="Rocket" width="25" height="25" />

### Leaderboard

|                                                                                                                                                                                        | Client       | Version |  Fastest in | Throughput | CPU per operation |       Peak memory |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------- | :------ | ----------: | ---------: | ----------------: | ----------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **solidis**  | 0.5.0   | **19** / 19 |  **1.00x** |         **1.00x** |         **1.00x** |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | node-redis   | 6.3.0   |      0 / 19 |      0.68x |             1.10x |             0.94x |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | speedkey     | 0.4.2   |      0 / 19 |      0.48x |             1.94x | 0.52x<sup>†</sup> |
|                                                                                                                                                                                     4. | iovalkey     | 0.4.0   |      0 / 19 |      0.42x |             2.16x |             1.41x |
|                                                                                                                                                                                     5. | ioredis      | 6.0.0   |      0 / 19 |      0.40x |             2.21x |             1.31x |
|                                                                                                                                                                                     6. | valkey-glide | 2.5.3   |      0 / 19 |      0.39x |             2.48x | 1.01x<sup>†</sup> |

<sub>Throughput, CPU per operation and peak memory are geometric means over all benchmarks, relative to `solidis` (1.00x). Higher throughput and lower CPU and memory are better.</sub>

<sub><sup>†</sup> Memory the client keeps in native code is not counted.</sub>

### Operations per Second

_100,000 operations × 10,000 concurrency · 1 KB payload · 5 repeats per client_

|                                                                                                                                                                                        | Benchmark                                                                                                          | **solidis** |            ioredis |           iovalkey | node-redis |       valkey-glide |           speedkey |                                                                                                                                                                          Lead                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------- | ----------: | -----------------: | -----------------: | ---------: | -----------------: | -----------------: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **Transaction Mixed**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup>                                                 |  **132.5K** |              28.4K |              30.5K |      61.4K |  42.1K<sup>1</sup> |              46.7K | **2.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | **Transaction**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup>                                     |  **166.5K** |              35.4K |              39.5K |      78.2K |  66.8K<sup>1</sup> |              55.7K | **2.1x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup>                                                   |  **303.1K** |             145.2K |             159.9K |     166.8K |  43.0K<sup>2</sup> | 130.9K<sup>2</sup> | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
|                                                                                                                                                                                     4. | **Set**<br/><sup><kbd>SET</kbd></sup>                                                                              |  **356.0K** |             145.1K |             154.9K |     212.1K |             114.2K |             168.2K | **1.7x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
|                                                                                                                                                                                     5. | **Set Read**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup>                               |  **162.9K** |              60.5K |              61.5K |     104.1K |  71.3K<sup>3</sup> |  84.3K<sup>3</sup> |                                                                                    **1.6x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     6. | **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup>                                    |  **140.3K** |              57.9K |              60.7K |      93.2K |  59.9K<sup>3</sup> |  69.1K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     7. | **Set Mutation**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup>                               |  **152.9K** |              55.1K |              66.2K |     104.6K |  72.6K<sup>3</sup> |  96.4K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     8. | **Hash Mutation**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup>                                 |  **130.5K** |              56.2K |              60.4K |      89.5K |  52.2K<sup>3</sup> |  63.4K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     9. | **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup>                                          |  **175.4K** |              74.9K |              75.2K |     120.8K |  82.1K<sup>3</sup> |  93.4K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    10. | **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup>                                                         |  **262.4K** |             125.4K |             127.9K |     186.6K | 102.3K<sup>3</sup> | 139.8K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    11. | **Pipeline Mixed**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup>                                    |  **159.4K** |              74.3K |              74.3K |     113.4K |  74.6K<sup>3</sup> |  84.4K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    12. | **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup>                                                       |  **147.7K** |              62.8K |              67.4K |     105.1K |  63.3K<sup>3</sup> |  74.3K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    13. | **List Range**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup>                                  |  **131.2K** |              54.7K |              56.8K |      94.2K |  58.8K<sup>3</sup> |  73.5K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    14. | **Non-Transaction**<br/><sup><kbd>SET PX</kbd> <kbd>GET</kbd></sup>                                                |  **197.5K** |              83.1K |              84.7K |     144.5K |  85.1K<sup>3</sup> | 104.4K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    15. | **Hash Round-Trip**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup>                              |  **147.7K** |              68.2K |              71.9K |     110.6K |  61.0K<sup>3</sup> |  71.0K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    16. | **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIG GET</kbd></sup>                                             |  **221.2K** | 110.6K<sup>4</sup> | 115.2K<sup>4</sup> |     169.3K |  90.6K<sup>3</sup> |  96.6K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    17. | **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup>                                        |  **139.5K** |              59.4K |              58.5K |     107.8K |  54.8K<sup>3</sup> |  54.8K<sup>3</sup> |                                                                           **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    18. | **List Mutation**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup> |  **109.2K** |              40.6K |              42.5K |      90.9K |  49.3K<sup>3</sup> |  58.3K<sup>3</sup> |                                                                           **1.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    19. | **Get**<br/><sup><kbd>GET</kbd></sup>                                                                              |  **349.1K** |             198.9K |             194.9K |     331.9K |             112.3K |             183.3K |                                                                           **1.1x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |

<sub>Median operations per second over the repeats; the fastest client of each benchmark is in bold. Lead = `solidis` ÷ the fastest other client.</sub>

<sub><sup>1</sup> Does not take MULTI and EXEC in a batch, so it sends the commands between them as an atomic batch</sub><br/>
<sub><sup>2</sup> Subscribes over RESP3, which it requires for Pub/Sub</sub><br/>
<sub><sup>3</sup> Does not keep the order of concurrent commands, so it sends each operation as one batch</sub><br/>
<sub><sup>4</sup> Does not auto-pipeline INFO</sub>

</div>

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Bar%20Chart.png?raw=true" alt="Bar Chart" width="25" height="25" /> Detailed Metrics

<sub>Per library: operations and commands per second, latency (p50 / p95 / p99 / p99.9), CPU and GC time per operation, peak memory and spread.</sub>

<details>
<summary>Click to expand the detailed metrics</summary>

| Benchmark                                                                                                                              | Library                  |  ops/s | cmds/s |      p50 |      p95 |      p99 |    p99.9 |  CPU/op |  GC/op |               Memory | Spread |
| :------------------------------------------------------------------------------------------------------------------------------------- | :----------------------- | -----: | -----: | -------: | -------: | -------: | -------: | ------: | -----: | -------------------: | -----: |
| **Transaction Mixed**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                 | **solidis**              | 132.5K | 794.9K |  70.12ms | 104.60ms | 123.74ms | 131.58ms | 17.12µs | 2.11µs |             355.0 MB |  ±1.6% |
|                                                                                                                                        | ioredis                  |  28.4K | 170.3K | 346.12ms | 370.91ms | 378.29ms | 383.11ms | 58.56µs | 6.27µs |             675.9 MB |  ±1.0% |
|                                                                                                                                        | iovalkey                 |  30.5K | 183.1K | 324.02ms | 352.41ms | 360.89ms | 366.14ms | 56.09µs | 7.13µs |             712.0 MB |  ±1.0% |
|                                                                                                                                        | node-redis               |  61.4K | 368.3K | 158.42ms | 186.61ms | 197.37ms | 199.98ms | 30.49µs | 4.13µs |             493.8 MB |  ±1.3% |
|                                                                                                                                        | valkey-glide<sup>1</sup> |  42.1K | 252.4K | 232.70ms | 256.89ms | 271.39ms | 279.51ms | 53.67µs | 7.64µs | 357.9 MB<sup>†</sup> |  ±0.4% |
|                                                                                                                                        | speedkey                 |  46.7K | 280.2K | 207.57ms | 241.01ms | 244.79ms | 248.64ms | 43.02µs | 3.37µs | 216.3 MB<sup>†</sup> |  ±0.4% |
| **Transaction**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                     | **solidis**              | 166.5K | 832.7K |  54.54ms | 100.24ms | 119.63ms | 134.20ms | 12.32µs | 1.66µs |             276.9 MB |  ±2.6% |
|                                                                                                                                        | ioredis                  |  35.4K | 177.0K | 277.25ms | 299.72ms | 306.31ms | 310.86ms | 46.15µs | 5.35µs |             623.5 MB |  ±1.6% |
|                                                                                                                                        | iovalkey                 |  39.5K | 197.6K | 247.88ms | 274.28ms | 286.69ms | 296.23ms | 43.91µs | 5.81µs |             659.2 MB |  ±1.5% |
|                                                                                                                                        | node-redis               |  78.2K | 390.8K | 121.76ms | 142.90ms | 147.92ms | 151.11ms | 25.00µs | 3.54µs |             530.2 MB |  ±1.1% |
|                                                                                                                                        | valkey-glide<sup>1</sup> |  66.8K | 333.9K | 140.20ms | 165.62ms | 185.39ms | 190.10ms | 32.32µs | 5.31µs | 383.2 MB<sup>†</sup> |  ±0.7% |
|                                                                                                                                        | speedkey                 |  55.7K | 278.4K | 174.39ms | 206.23ms | 224.50ms | 228.87ms | 35.68µs | 2.99µs | 204.5 MB<sup>†</sup> |  ±1.1% |
| **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup><br/><sub>1 KB</sub>                                                   | **solidis**              | 303.1K | 303.1K |   7.57ms |  19.79ms |  24.66ms |  27.60ms |  6.78µs | 0.83µs |             145.4 MB |  ±3.5% |
|                                                                                                                                        | ioredis                  | 145.2K | 145.2K |  16.85ms |  28.90ms |  36.91ms |  39.20ms | 13.07µs | 1.68µs |             221.4 MB |  ±1.4% |
|                                                                                                                                        | iovalkey                 | 159.9K | 159.9K |  15.75ms |  29.35ms |  33.67ms |  38.27ms | 12.74µs | 1.81µs |             235.2 MB |  ±2.2% |
|                                                                                                                                        | node-redis               | 166.8K | 166.8K |  16.38ms |  24.13ms |  28.24ms |  30.51ms |  8.19µs | 2.25µs |             178.3 MB |  ±2.0% |
|                                                                                                                                        | valkey-glide<sup>2</sup> |  43.0K |  43.0K |  52.65ms |  81.81ms |  85.68ms |  89.88ms | 57.68µs | 2.29µs | 110.0 MB<sup>†</sup> |  ±0.7% |
|                                                                                                                                        | speedkey<sup>2</sup>     | 130.9K | 130.9K |  16.22ms |  23.84ms |  28.77ms |  32.57ms | 19.00µs | 1.02µs |  62.8 MB<sup>†</sup> |  ±1.8% |
| **Set**<br/><sup><kbd>SET</kbd></sup><br/><sub>1 KB</sub>                                                                              | **solidis**              | 356.0K | 356.0K |  24.78ms |  46.98ms |  57.86ms |  64.22ms |  6.55µs | 1.04µs |             181.3 MB |  ±3.7% |
|                                                                                                                                        | ioredis                  | 145.1K | 145.1K |  62.17ms |  93.33ms | 100.36ms | 104.09ms | 12.90µs | 1.97µs |             312.3 MB |  ±2.3% |
|                                                                                                                                        | iovalkey                 | 154.9K | 154.9K |  59.48ms |  86.10ms |  92.95ms |  95.54ms | 12.70µs | 1.90µs |             271.4 MB |  ±2.7% |
|                                                                                                                                        | node-redis               | 212.1K | 212.1K |  43.51ms |  51.20ms |  54.58ms |  60.20ms |  8.12µs | 1.75µs |             178.7 MB |  ±2.4% |
|                                                                                                                                        | valkey-glide             | 114.2K | 114.2K |  83.73ms |  93.18ms |  96.19ms |  99.66ms | 18.27µs | 2.02µs | 217.0 MB<sup>†</sup> |  ±3.3% |
|                                                                                                                                        | speedkey                 | 168.2K | 168.2K |  55.88ms |  74.43ms |  87.11ms |  92.06ms | 14.80µs | 1.06µs | 159.1 MB<sup>†</sup> |  ±1.6% |
| **Set Read**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              | 162.9K | 488.7K |  57.45ms |  88.11ms | 106.83ms | 115.27ms | 13.78µs | 2.06µs |             327.6 MB |  ±3.1% |
|                                                                                                                                        | ioredis                  |  60.5K | 181.4K | 162.63ms | 191.33ms | 197.90ms | 199.53ms | 35.30µs | 4.64µs |             383.1 MB |  ±1.2% |
|                                                                                                                                        | iovalkey                 |  61.5K | 184.6K | 158.74ms | 191.50ms | 196.95ms | 201.00ms | 34.73µs | 4.74µs |             400.5 MB |  ±1.3% |
|                                                                                                                                        | node-redis               | 104.1K | 312.2K |  92.27ms | 105.62ms | 109.07ms | 115.38ms | 15.10µs | 3.08µs |             278.0 MB |  ±1.8% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  71.3K | 214.0K | 135.26ms | 150.82ms | 155.33ms | 160.75ms | 30.18µs | 4.88µs | 321.0 MB<sup>†</sup> |  ±0.8% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  84.3K | 253.0K | 115.27ms | 126.04ms | 130.79ms | 144.30ms | 24.96µs | 2.02µs |  78.1 MB<sup>†</sup> |  ±1.4% |
| **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              | 140.3K | 420.9K |  65.02ms |  95.45ms | 112.17ms | 117.71ms | 16.28µs | 2.32µs |             404.2 MB |  ±1.4% |
|                                                                                                                                        | ioredis                  |  57.9K | 173.6K | 168.48ms | 200.79ms | 205.04ms | 208.56ms | 37.32µs | 4.79µs |             393.1 MB |  ±1.3% |
|                                                                                                                                        | iovalkey                 |  60.7K | 182.2K | 162.05ms | 186.91ms | 189.72ms | 192.45ms | 35.19µs | 4.67µs |             394.4 MB |  ±1.9% |
|                                                                                                                                        | node-redis               |  93.2K | 279.5K | 103.60ms | 122.63ms | 127.58ms | 130.61ms | 17.25µs | 3.51µs |             338.6 MB |  ±1.7% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  59.9K | 179.7K | 160.13ms | 182.43ms | 190.40ms | 193.48ms | 35.28µs | 6.02µs | 349.7 MB<sup>†</sup> |  ±0.9% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  69.1K | 207.2K | 141.32ms | 164.73ms | 168.61ms | 172.56ms | 29.13µs | 2.24µs | 210.0 MB<sup>†</sup> |  ±0.7% |
| **Set Mutation**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              | 152.9K | 458.6K |  57.67ms | 104.40ms | 123.07ms | 134.32ms | 15.56µs | 2.29µs |             265.1 MB |  ±1.9% |
|                                                                                                                                        | ioredis                  |  55.1K | 165.4K | 174.92ms | 196.12ms | 200.65ms | 201.32ms | 35.96µs | 4.89µs |             187.6 MB |  ±5.8% |
|                                                                                                                                        | iovalkey                 |  66.2K | 198.7K | 151.80ms | 188.76ms | 191.03ms | 194.93ms | 37.43µs | 4.26µs |             294.2 MB |  ±8.2% |
|                                                                                                                                        | node-redis               | 104.6K | 313.8K |  92.45ms | 105.27ms | 110.87ms | 115.11ms | 14.33µs | 3.08µs |             228.8 MB |  ±1.8% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  72.6K | 217.7K | 134.47ms | 153.15ms | 159.20ms | 163.81ms | 29.02µs | 4.96µs | 342.3 MB<sup>†</sup> |  ±2.7% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  96.4K | 289.2K | 102.52ms | 112.37ms | 115.10ms | 119.18ms | 22.20µs | 1.76µs | 115.0 MB<sup>†</sup> |  ±1.6% |
| **Hash Mutation**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup><br/><sub>1 KB</sub>                                 | **solidis**              | 130.5K | 391.6K |  69.68ms | 100.14ms | 115.13ms | 120.94ms | 17.87µs | 2.22µs |             399.9 MB |  ±0.3% |
|                                                                                                                                        | ioredis                  |  56.2K | 168.6K | 174.78ms | 203.33ms | 211.24ms | 219.82ms | 44.49µs | 4.92µs |             430.7 MB |  ±2.0% |
|                                                                                                                                        | iovalkey                 |  60.4K | 181.3K | 165.38ms | 176.03ms | 178.38ms | 180.51ms | 42.29µs | 4.87µs |             429.1 MB |  ±3.1% |
|                                                                                                                                        | node-redis               |  89.5K | 268.4K | 106.00ms | 125.76ms | 134.81ms | 140.32ms | 18.41µs | 3.41µs |             320.4 MB |  ±1.5% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  52.2K | 156.5K | 183.89ms | 208.17ms | 217.01ms | 222.77ms | 40.76µs | 6.46µs | 336.4 MB<sup>†</sup> |  ±2.1% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  63.4K | 190.2K | 151.73ms | 178.17ms | 182.61ms | 185.93ms | 31.35µs | 2.37µs | 191.1 MB<sup>†</sup> |  ±0.8% |
| **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup><br/><sub>1 KB</sub>                                          | **solidis**              | 175.4K | 526.1K |  51.60ms |  82.16ms |  92.27ms | 106.50ms | 12.97µs | 2.01µs |             289.9 MB |  ±2.3% |
|                                                                                                                                        | ioredis                  |  74.9K | 224.6K | 130.23ms | 152.72ms | 156.33ms | 158.18ms | 25.14µs | 3.98µs |             533.4 MB |  ±2.1% |
|                                                                                                                                        | iovalkey                 |  75.2K | 225.7K | 129.43ms | 149.35ms | 162.17ms | 164.92ms | 25.60µs | 4.17µs |             489.2 MB |  ±1.1% |
|                                                                                                                                        | node-redis               | 120.8K | 362.4K |  79.70ms |  93.58ms |  96.63ms | 100.07ms | 13.10µs | 3.14µs |             238.8 MB |  ±3.7% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  82.1K | 246.2K | 117.76ms | 132.29ms | 138.60ms | 141.98ms | 25.11µs | 4.85µs | 413.2 MB<sup>†</sup> |  ±1.6% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  93.4K | 280.1K | 105.14ms | 115.74ms | 119.87ms | 124.03ms | 22.43µs | 1.78µs | 126.8 MB<sup>†</sup> |  ±1.2% |
| **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup><br/><sub>1 KB</sub>                                                         | **solidis**              | 262.4K | 524.8K |  34.20ms |  52.69ms |  58.33ms |  62.51ms |  9.51µs | 1.59µs |             228.6 MB |  ±2.0% |
|                                                                                                                                        | ioredis                  | 125.4K | 250.7K |  74.59ms | 109.70ms | 118.82ms | 124.46ms | 16.84µs | 2.90µs |             308.3 MB |  ±3.1% |
|                                                                                                                                        | iovalkey                 | 127.9K | 255.7K |  70.72ms | 107.32ms | 113.78ms | 125.35ms | 16.92µs | 3.07µs |             329.1 MB |  ±2.5% |
|                                                                                                                                        | node-redis               | 186.6K | 373.3K |  50.13ms |  59.98ms |  64.47ms |  67.42ms |  9.23µs | 2.39µs |             227.4 MB |  ±2.2% |
|                                                                                                                                        | valkey-glide<sup>3</sup> | 102.3K | 204.6K |  88.66ms | 125.92ms | 156.24ms | 171.11ms | 22.60µs | 3.70µs | 391.4 MB<sup>†</sup> |  ±4.9% |
|                                                                                                                                        | speedkey<sup>3</sup>     | 139.8K | 279.5K |  68.88ms |  77.58ms |  81.67ms |  83.81ms | 15.62µs | 1.51µs | 254.2 MB<sup>†</sup> |  ±1.1% |
| **Pipeline Mixed**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              | 159.4K | 478.1K |  56.72ms |  88.80ms | 104.28ms | 110.44ms | 14.21µs | 2.17µs |             336.4 MB |  ±1.7% |
|                                                                                                                                        | ioredis                  |  74.3K | 222.9K | 131.97ms | 158.64ms | 164.94ms | 172.81ms | 28.03µs | 4.10µs |             450.3 MB |  ±2.6% |
|                                                                                                                                        | iovalkey                 |  74.3K | 223.0K | 130.91ms | 152.24ms | 158.42ms | 162.28ms | 27.40µs | 4.34µs |             522.1 MB |  ±1.8% |
|                                                                                                                                        | node-redis               | 113.4K | 340.1K |  85.15ms |  98.70ms | 104.64ms | 111.44ms | 13.94µs | 3.15µs |             281.2 MB |  ±1.5% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  74.6K | 223.7K | 129.56ms | 153.25ms | 161.30ms | 166.34ms | 28.57µs | 4.92µs | 339.4 MB<sup>†</sup> |  ±2.0% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  84.4K | 253.1K | 115.07ms | 134.02ms | 140.54ms | 143.74ms | 24.46µs | 2.06µs | 223.8 MB<sup>†</sup> |  ±0.5% |
| **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup><br/><sub>1 KB</sub>                                                       | **solidis**              | 147.7K | 295.5K |  64.49ms |  86.36ms | 100.38ms | 104.60ms | 15.41µs | 1.83µs |             350.8 MB |  ±3.9% |
|                                                                                                                                        | ioredis                  |  62.8K | 125.5K | 154.87ms | 177.43ms | 182.32ms | 183.74ms | 39.05µs | 4.19µs |             385.0 MB |  ±3.7% |
|                                                                                                                                        | iovalkey                 |  67.4K | 134.7K | 146.24ms | 173.38ms | 181.29ms | 189.76ms | 32.02µs | 3.91µs |             428.8 MB |  ±1.9% |
|                                                                                                                                        | node-redis               | 105.1K | 210.2K |  91.82ms | 102.45ms | 106.52ms | 108.26ms | 16.33µs | 2.75µs |             313.4 MB |  ±1.5% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  63.3K | 126.5K | 152.95ms | 170.14ms | 176.42ms | 185.40ms | 35.85µs | 4.82µs | 282.1 MB<sup>†</sup> |  ±1.3% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  74.3K | 148.6K | 131.27ms | 155.16ms | 171.15ms | 180.26ms | 27.13µs | 2.09µs | 169.7 MB<sup>†</sup> |  ±2.3% |
| **List Range**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup><br/><sub>1 KB</sub>                                  | **solidis**              | 131.2K | 393.5K |  69.95ms | 103.30ms | 109.45ms | 116.98ms | 17.80µs | 2.34µs |             417.8 MB |  ±1.2% |
|                                                                                                                                        | ioredis                  |  54.7K | 164.1K | 178.30ms | 212.07ms | 224.47ms | 236.55ms | 45.99µs | 5.48µs |             449.6 MB |  ±2.2% |
|                                                                                                                                        | iovalkey                 |  56.8K | 170.5K | 175.74ms | 197.62ms | 205.68ms | 208.19ms | 43.64µs | 5.26µs |             441.4 MB |  ±1.6% |
|                                                                                                                                        | node-redis               |  94.2K | 282.6K | 104.29ms | 118.01ms | 125.99ms | 128.87ms | 17.91µs | 3.21µs |             319.4 MB |  ±2.8% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  58.8K | 176.3K | 161.20ms | 187.31ms | 190.90ms | 196.41ms | 38.06µs | 5.60µs | 303.6 MB<sup>†</sup> |  ±1.0% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  73.5K | 220.6K | 131.35ms | 158.48ms | 172.43ms | 177.30ms | 28.46µs | 2.31µs | 179.7 MB<sup>†</sup> |  ±1.3% |
| **Non-Transaction**<br/><sup><kbd>SET PX</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                | **solidis**              | 197.5K | 395.1K |  46.50ms |  76.67ms |  90.69ms |  98.33ms | 11.55µs | 1.66µs |             272.8 MB |  ±1.1% |
|                                                                                                                                        | ioredis                  |  83.1K | 166.3K | 116.04ms | 142.81ms | 149.81ms | 151.03ms | 23.17µs | 3.19µs |             387.3 MB |  ±1.4% |
|                                                                                                                                        | iovalkey                 |  84.7K | 169.3K | 113.36ms | 132.95ms | 137.89ms | 145.90ms | 22.46µs | 3.24µs |             390.0 MB |  ±2.2% |
|                                                                                                                                        | node-redis               | 144.5K | 289.0K |  65.92ms |  75.51ms |  79.03ms |  83.40ms | 11.24µs | 2.34µs |             232.7 MB |  ±0.5% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  85.1K | 170.1K | 109.85ms | 129.41ms | 140.79ms | 149.96ms | 25.84µs | 4.15µs | 311.3 MB<sup>†</sup> |  ±1.5% |
|                                                                                                                                        | speedkey<sup>3</sup>     | 104.4K | 208.9K |  92.28ms | 107.85ms | 113.26ms | 119.84ms | 20.60µs | 1.81µs | 193.2 MB<sup>†</sup> |  ±1.7% |
| **Hash Round-Trip**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup><br/><sub>1 KB</sub>                              | **solidis**              | 147.7K | 443.1K |  63.48ms |  84.71ms | 103.02ms | 109.62ms | 16.02µs | 2.07µs |             374.2 MB |  ±1.8% |
|                                                                                                                                        | ioredis                  |  68.2K | 204.6K | 138.85ms | 166.02ms | 176.19ms | 181.51ms | 30.30µs | 4.22µs |             491.1 MB |  ±2.1% |
|                                                                                                                                        | iovalkey                 |  71.9K | 215.6K | 133.63ms | 160.28ms | 170.04ms | 172.21ms | 31.00µs | 4.55µs |             515.4 MB |  ±1.2% |
|                                                                                                                                        | node-redis               | 110.6K | 331.7K |  86.63ms | 101.35ms | 105.52ms | 110.35ms | 15.56µs | 3.05µs |             342.5 MB |  ±1.1% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  61.0K | 182.9K | 154.45ms | 184.80ms | 199.99ms | 215.36ms | 34.45µs | 5.54µs | 324.6 MB<sup>†</sup> |  ±1.6% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  71.0K | 213.1K | 135.19ms | 160.95ms | 166.53ms | 171.68ms | 29.42µs | 2.40µs | 167.1 MB<sup>†</sup> |  ±1.4% |
| **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIG GET</kbd></sup><br/><sub>1 KB</sub>                                             | **solidis**              | 221.2K | 442.5K |  39.95ms |  73.97ms |  82.66ms |  90.49ms | 10.78µs | 1.73µs |             287.0 MB |  ±2.1% |
|                                                                                                                                        | ioredis<sup>4</sup>      | 110.6K | 221.1K |  83.65ms | 124.04ms | 131.03ms | 134.61ms | 17.48µs | 2.37µs |             277.8 MB |  ±2.2% |
|                                                                                                                                        | iovalkey<sup>4</sup>     | 115.2K | 230.4K |  79.88ms | 119.99ms | 124.72ms | 131.39ms | 17.14µs | 2.54µs |             306.6 MB |  ±2.3% |
|                                                                                                                                        | node-redis               | 169.3K | 338.6K |  54.65ms |  74.43ms |  80.83ms |  87.86ms | 10.97µs | 2.39µs |             250.1 MB |  ±2.3% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  90.6K | 181.3K | 100.03ms | 140.45ms | 155.33ms | 163.00ms | 26.04µs | 4.24µs | 377.8 MB<sup>†</sup> |  ±1.5% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  96.6K | 193.3K | 101.23ms | 114.58ms | 119.81ms | 124.42ms | 21.08µs | 2.03µs | 233.9 MB<sup>†</sup> |  ±1.3% |
| **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup><br/><sub>1 KB</sub>                                        | **solidis**              | 139.5K | 418.4K |  66.28ms |  96.73ms | 114.80ms | 121.81ms | 15.95µs | 2.44µs |             392.6 MB |  ±0.9% |
|                                                                                                                                        | ioredis                  |  59.4K | 178.2K | 167.32ms | 191.14ms | 195.19ms | 197.60ms | 32.45µs | 4.35µs |             479.0 MB |  ±1.5% |
|                                                                                                                                        | iovalkey                 |  58.5K | 175.6K | 168.64ms | 192.02ms | 196.39ms | 198.54ms | 31.14µs | 4.61µs |             495.7 MB |  ±1.3% |
|                                                                                                                                        | node-redis               | 107.8K | 323.5K |  89.09ms | 101.16ms | 104.43ms | 106.34ms | 15.09µs | 3.35µs |             330.1 MB |  ±1.3% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  54.8K | 164.4K | 170.22ms | 209.88ms | 221.70ms | 224.57ms | 38.61µs | 6.18µs | 392.2 MB<sup>†</sup> |  ±2.0% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  54.8K | 164.5K | 175.82ms | 206.03ms | 211.25ms | 215.09ms | 35.23µs | 2.92µs | 205.8 MB<sup>†</sup> |  ±1.6% |
| **List Mutation**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup><br/><sub>1 KB</sub> | **solidis**              | 109.2K | 545.8K |  84.41ms | 117.64ms | 152.66ms | 163.60ms | 21.59µs | 3.11µs |             417.4 MB |  ±1.9% |
|                                                                                                                                        | ioredis                  |  40.6K | 202.8K | 245.86ms | 264.10ms | 274.65ms | 277.34ms | 55.64µs | 8.90µs |             434.6 MB |  ±3.6% |
|                                                                                                                                        | iovalkey                 |  42.5K | 212.6K | 234.84ms | 266.72ms | 269.97ms | 298.16ms | 56.50µs | 8.37µs |             524.8 MB |  ±2.3% |
|                                                                                                                                        | node-redis               |  90.9K | 454.3K | 106.70ms | 131.70ms | 144.48ms | 146.92ms | 19.83µs | 2.35µs |             362.4 MB |  ±2.5% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  49.3K | 246.6K | 199.23ms | 220.93ms | 226.34ms | 231.28ms | 43.29µs | 6.92µs | 339.7 MB<sup>†</sup> |  ±1.0% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  58.3K | 291.5K | 167.89ms | 189.70ms | 197.26ms | 200.47ms | 35.49µs | 2.64µs | 107.3 MB<sup>†</sup> |  ±1.1% |
| **Get**<br/><sup><kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                                              | **solidis**              | 349.1K | 349.1K |  26.29ms |  38.46ms |  43.11ms |  47.54ms |  6.48µs | 0.84µs |             120.6 MB |  ±1.8% |
|                                                                                                                                        | ioredis                  | 198.9K | 198.9K |  45.80ms |  74.08ms |  84.56ms |  87.51ms |  9.63µs | 1.51µs |             242.7 MB |  ±2.5% |
|                                                                                                                                        | iovalkey                 | 194.9K | 194.9K |  46.63ms |  78.77ms |  89.55ms |  99.36ms | 10.12µs | 1.70µs |             294.0 MB |  ±2.6% |
|                                                                                                                                        | node-redis               | 331.9K | 331.9K |  27.86ms |  41.35ms |  45.10ms |  48.94ms |  7.28µs | 0.88µs |              91.9 MB |  ±5.7% |
|                                                                                                                                        | valkey-glide             | 112.3K | 112.3K |  80.98ms | 150.33ms | 181.25ms | 212.64ms | 19.22µs | 1.22µs |  77.5 MB<sup>†</sup> |  ±3.9% |
|                                                                                                                                        | speedkey                 | 183.3K | 183.3K |  50.90ms |  67.07ms |  78.32ms |  86.58ms | 15.68µs | 1.17µs |  51.8 MB<sup>†</sup> |  ±3.3% |

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
| Concurrency per connection | 10,000                                                                                             |
| Repeats                    | 5                                                                                                  |
| Cooldown                   | 300ms                                                                                              |
| Date                       | 2026-10-05 02:30:21                                                                                |

</details>

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Open%20Book.png?raw=true" alt="Open Book" width="25" height="25" /> Methodology

- Every sample runs in its own **worker thread**, so garbage collection and JIT state never carry over.
- The library order **rotates** per sample, and the server is **flushed and settled** before each one.
- All libraries get the same **deterministic binary payloads**, and every reply and Pub/Sub message is checked after the measured phase.
- Transaction and Transaction Mixed send each operation as one batch (`batch` mode). Pub/Sub publishes at most 4 MB of messages at a time and waits until they arrive.
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
  lazyConnect: false,                     // true waits for connect() or the first command

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
    maxBulkStringLength: 536_870_912,     // 512MB
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

| Error class              | When                                                                                        |
| :----------------------- | :------------------------------------------------------------------------------------------ |
| `SolidisCommandError`    | Server error (`cause` is the `RespError`), unexpected reply, refused options                |
| `SolidisClientError`     | Not ready in time, refused handshake, quit, throwing event listener                         |
| `SolidisConnectionError` | Connect failure or timeout, invalid port, lost connection, retries spent, refusal           |
| `SolidisRequesterError`  | Command timeout, unsent command on a lost connection, malformed or refused `send()` command |
| `SolidisParserError`     | Malformed RESP, oversized bulk string or line, nesting past 512 levels                      |
| `SolidisPubSubError`     | Malformed Pub/Sub event, throwing Pub/Sub or push listener                                  |

> [!NOTE]
>
> - Errors for arguments of the declared types are `SolidisError`s linked by the standard `cause`.
> - Messages add the command name (`[INCR] ERR ...`), not its arguments. A quoted argument becomes `'***'` in the message and in `cause`. Unquoted echoes and text quoted from inside an argument stay: GEOADD coordinates, `redis.error_reply()` text, a FUNCTION LOAD library name, a Lua token in a script error.
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

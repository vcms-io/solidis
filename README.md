<h1 align="center"><img src="./assets/solidis.png" alt="Solidis" width="50"/></h1>

<h3 align="center">
  <b>The fastest Redis client for Node.js.<br/>Zero dependencies, battle-tested in production.</b>
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
  <a href="#quick-start">Quick Start</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#features">Features</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#configuration">Configuration</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#architecture">Architecture</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="#extensions">Extensions</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="./README.ko.md">한국어</a>
</p>

<br/>

<p align="center">
  <img src="./assets/bundle.png" alt="Bundle size comparison" width="640"/>
</p>

<table align="center">
<tr>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Rocket.png?raw=true" alt="Rocket" width="32" height="32" /><br/><strong>0 deps</strong><br/><sub>zero dependencies</sub></td>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Package.png?raw=true" alt="Package" width="32" height="32" /><br/><strong>384</strong><br/><sub>commands</sub></td>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Test%20Tube.png?raw=true" alt="Test Tube" width="32" height="32" /><br/><strong>35K+</strong><br/><sub>lines of tests</sub></td>
<td align="center"><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Animals/Feather.png?raw=true" alt="Feather" width="32" height="32" /><br/><strong>&lt; 30KB</strong><br/><sub>min bundle</sub></td>
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
> **Need a smaller bundle?** Use `SolidisClient` with `.extend()` to import only the commands you use: **< 30KB** with tree-shaking.

<details>
<summary>&nbsp;&nbsp;<b>Tree-shakable client</b></summary>

<br/>

```typescript
import { SolidisClient } from '@vcms-io/solidis';
import { get } from '@vcms-io/solidis/command/get';
import { set } from '@vcms-io/solidis/command/set';

const client = new SolidisClient({ host: '127.0.0.1', port: 6379 }).extend({ get, set });
```

`extend()` binds the object's functions to the client, the methods of its class included.

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
- A queued call passes its arguments on once more, so it takes about half as many spread items as a direct call. Send larger commands with `send()`.
- A refused `MULTI` (no `@transaction`) leaves the queue to run alone, and `exec()` rejects with `[MULTI]`.
- After a reconnect loses a `WATCH`, the next `EXEC` becomes `DISCARD` and returns `null`. After it loses a raw `MULTI`, only `MULTI`, `EXEC`, `DISCARD` and `RESET` pass.
- `AUTH` and `HELLO` go out only after every earlier reply, a blocking command's included, since Redis 7.2 and later drop the error of a failed `AUTH` while other replies are pending. Later commands wait for their reply, and a command's timeout starts when it goes out.
- `send()` refuses `AUTH` and `HELLO` after another command of the same batch or inside a transaction. A RESP3 push pending on the server at that moment still drops the error, and the `AUTH` times out.

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

- When a cluster node stops serving a slot, it unsubscribes clients from the slot's shard channels with messages identical to `SUNSUBSCRIBE` replies. A `SUNSUBSCRIBE` sent at that moment can take one as its reply and pass its own reply to the next command.

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
- `migrate()` adds its `timeout` the same way, and like the server counts `0` or less as 1,000 ms. `shutdown()` waits for the connection to close without a deadline, unless it aborts.

</details>

<details>
<summary>&nbsp;&nbsp;<b>Large integers</b></summary>

<br/>

```typescript
const views = await client.incr('views', { bigint: true }); // bigint
```

- Commands return integers as `number` and reject one past `Number.MAX_SAFE_INTEGER`, such as a TTL or a time-series timestamp. The command has run by then; `cause` holds the exact `bigint`.
- INCR, INCRBY, DECR, DECRBY, HINCRBY, BITFIELD and BITFIELD_RO take `{ bigint: true }`, which returns every integer as a `bigint`; the return type follows.
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
| Stored as is                 | SET, SETNX, SETEX, PSETEX, GETSET, SETRANGE, APPEND, MSET, MSETNX, HSET, HSETNX, HMSET, LPUSH, RPUSH, LPUSHX, RPUSHX, LSET, LINSERT, XADD, RESTORE             |
| Compared values              | LINSERT, LREM, LPOS, SMISMEMBER, DELEX, SET                                                                                                                    |
| Other arguments              | PUBLISH, SPUBLISH (message) · FUNCTION RESTORE (dump) · BF.LOADCHUNK, CF.LOADCHUNK (chunk) · AUTH, HELLO (credentials) · `send()` (any argument)               |
| Read with `{ buffer: true }` | GET, GETDEL, GETEX, GETRANGE, MGET, HGET, HMGET, HGETALL, HVALS, LINDEX, LRANGE, LPOP, RPOP, LMOVE, BLMOVE, RPOPLPUSH, BRPOPLPUSH, BLPOP, BRPOP, LMPOP, BLMPOP |

- A `Buffer` reply is a view of the chunk it arrived in (up to 64 KB). Copy it with `Buffer.from()` to keep it long.
- `send()` copies command arrays, not the `Buffer`s in them: keep a `Buffer` unchanged until its command settles.
- Field names (HGETALL, HSCAN, streams) and RESP3 map keys, also from `send()`, decode as UTF-8, so invalid UTF-8 names can collide. Keep binary data in values.
- Stream, set and sorted-set reads, HSCAN, HRANDFIELD, GETSET, SORT, SORT_RO and LCS return values as UTF-8 strings; read binary values from them with `send()`.
- DUMP and FUNCTION DUMP return the payload as a latin1 string. Pass it to `restore()` or `functionRestore()` as it is, or read its bytes with `Buffer.from(value, 'latin1')`.
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
- `xautoclaim()` with `justid` returns its IDs as entries with empty `fields`; `xclaim()` with `justid` returns the IDs alone.

</details>

<br/>

<div id="benchmark">

## <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Bar%20Chart.png?raw=true" alt="Bar Chart" width="25" height="25" /> Benchmarks

<div align="center">

# <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" /> Solidis vs ioredis, iovalkey, node-redis, valkey-glide and speedkey

<small>Generated on 2026-10-05 15:52:42 UTC · linux x64 · Node.js v22.23.0 · Redis 8.10.2</small>

### Fastest in **19** of **19** benchmarks · **1.5x** the throughput of the next-fastest client on average <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Rocket.png?raw=true" alt="Rocket" width="25" height="25" />

### Leaderboard

|                                                                                                                                                                                        | Client       | Version |  Fastest in | Throughput | CPU per operation |       Peak memory |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------- | :------ | ----------: | ---------: | ----------------: | ----------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **solidis**  | 0.5.0   | **19** / 19 |  **1.00x** |         **1.00x** |         **1.00x** |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | node-redis   | 6.3.0   |      0 / 19 |      0.67x |             1.11x |             0.92x |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | speedkey     | 0.4.2   |      0 / 19 |      0.47x |             1.98x | 0.46x<sup>†</sup> |
|                                                                                                                                                                                     4. | iovalkey     | 0.4.0   |      0 / 19 |      0.41x |             2.17x |             1.40x |
|                                                                                                                                                                                     5. | ioredis      | 6.0.0   |      0 / 19 |      0.40x |             2.22x |             1.30x |
|                                                                                                                                                                                     6. | valkey-glide | 2.5.3   |      0 / 19 |      0.38x |             2.50x | 1.01x<sup>†</sup> |

<sub>Throughput, CPU per operation and peak memory are geometric means over all benchmarks, relative to `solidis` (1.00x). Higher throughput and lower CPU and memory are better.</sub>

<sub><sup>†</sup> Memory the client keeps in native code is not counted.</sub>

### Operations per Second

_100,000 operations × 10,000 concurrency · 1 KB payload · 10 repeats per client_

|                                                                                                                                                                                        | Benchmark                                                                                                          | **solidis** |            ioredis |           iovalkey | node-redis |       valkey-glide |           speedkey |                                                                                                                                                                          Lead                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------- | ----------: | -----------------: | -----------------: | ---------: | -----------------: | -----------------: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **Transaction Mixed**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup>                                                 |  **134.5K** |              27.4K |              29.9K |      60.7K |  41.1K<sup>1</sup> |              45.2K | **2.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | **Transaction**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup>                                     |  **167.6K** |              34.8K |              38.2K |      77.8K |  66.2K<sup>1</sup> |              54.7K | **2.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup>                                                   |  **296.5K** |             142.9K |             156.2K |     154.7K |  43.1K<sup>2</sup> | 129.6K<sup>2</sup> | **1.9x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
|                                                                                                                                                                                     4. | **Set**<br/><sup><kbd>SET</kbd></sup>                                                                              |  **349.2K** |             144.7K |             148.2K |     217.0K |             114.3K |             167.7K | **1.6x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
|                                                                                                                                                                                     5. | **Set Read**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup>                               |  **159.1K** |              59.5K |              59.4K |     102.9K |  69.2K<sup>3</sup> |  79.2K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     6. | **Pipeline Mixed**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup>                                    |  **164.8K** |              71.0K |              72.7K |     110.5K |  70.4K<sup>3</sup> |  82.6K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     7. | **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup>                                          |  **172.5K** |              73.1K |              73.2K |     115.7K |  79.8K<sup>3</sup> |  89.1K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     8. | **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup>                                    |  **142.4K** |              58.9K |              62.1K |      96.8K |  59.8K<sup>3</sup> |  69.6K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     9. | **Set Mutation**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup>                               |  **149.2K** |              52.9K |              54.8K |     101.6K |  68.1K<sup>3</sup> |  89.6K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    10. | **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup>                                                       |  **148.4K** |              62.4K |              68.6K |     102.3K |  62.5K<sup>3</sup> |  72.2K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    11. | **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup>                                                         |  **265.7K** |             124.2K |             129.7K |     187.6K | 105.7K<sup>3</sup> | 134.1K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    12. | **Non-Transaction**<br/><sup><kbd>SET PX</kbd> <kbd>GET</kbd></sup>                                                |  **195.1K** |              84.6K |              85.4K |     137.8K |  83.3K<sup>3</sup> | 101.6K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    13. | **Hash Mutation**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup>                                 |  **125.3K** |              53.6K |              57.4K |      88.6K |  51.3K<sup>3</sup> |  58.8K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    14. | **List Range**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup>                                  |  **129.0K** |              54.6K |              56.3K |      92.3K |  57.7K<sup>3</sup> |  71.9K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    15. | **Hash Round-Trip**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup>                              |  **144.4K** |              66.4K |              69.0K |     104.0K |  61.1K<sup>3</sup> |  66.9K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    16. | **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup>                                        |  **140.8K** |              58.8K |              59.3K |     106.6K |  54.0K<sup>3</sup> |  55.5K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    17. | **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIG GET</kbd></sup>                                             |  **224.1K** | 111.8K<sup>4</sup> | 115.3K<sup>4</sup> |     176.2K |  91.0K<sup>3</sup> |  97.0K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    18. | **List Mutation**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup> |  **107.3K** |              40.1K |              40.7K |      88.2K |  48.6K<sup>3</sup> |  57.0K<sup>3</sup> |                                                                           **1.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    19. | **Get**<br/><sup><kbd>GET</kbd></sup>                                                                              |  **350.1K** |             192.0K |             189.2K |     322.8K |             112.0K |             177.6K |                                                                           **1.1x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |

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
| **Transaction Mixed**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                 | **solidis**              | 134.5K | 807.2K |  71.01ms | 103.67ms | 127.03ms | 139.02ms | 17.04µs | 2.10µs |             354.5 MB |  ±3.3% |
|                                                                                                                                        | ioredis                  |  27.4K | 164.2K | 354.91ms | 393.55ms | 420.46ms | 435.65ms | 60.52µs | 6.51µs |             675.6 MB |  ±1.9% |
|                                                                                                                                        | iovalkey                 |  29.9K | 179.2K | 330.10ms | 369.66ms | 400.34ms | 419.90ms | 57.45µs | 7.15µs |             711.5 MB |  ±2.1% |
|                                                                                                                                        | node-redis               |  60.7K | 364.2K | 161.21ms | 194.84ms | 202.59ms | 209.04ms | 30.87µs | 4.14µs |             491.5 MB |  ±3.2% |
|                                                                                                                                        | valkey-glide<sup>1</sup> |  41.1K | 246.6K | 240.87ms | 266.52ms | 284.39ms | 290.36ms | 54.74µs | 7.90µs | 357.4 MB<sup>†</sup> |  ±3.1% |
|                                                                                                                                        | speedkey                 |  45.2K | 271.1K | 214.38ms | 256.05ms | 295.61ms | 311.12ms | 44.69µs | 3.49µs | 216.4 MB<sup>†</sup> |  ±3.1% |
| **Transaction**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                     | **solidis**              | 167.6K | 837.8K |  54.50ms |  98.86ms | 115.78ms | 125.05ms | 12.48µs | 1.66µs |             276.9 MB |  ±1.7% |
|                                                                                                                                        | ioredis                  |  34.8K | 174.0K | 282.19ms | 306.98ms | 318.97ms | 325.83ms | 46.63µs | 5.39µs |             622.0 MB |  ±1.8% |
|                                                                                                                                        | iovalkey                 |  38.2K | 190.8K | 255.41ms | 278.59ms | 291.74ms | 303.42ms | 44.92µs | 5.86µs |             650.3 MB |  ±1.3% |
|                                                                                                                                        | node-redis               |  77.8K | 389.2K | 122.50ms | 142.11ms | 148.71ms | 152.53ms | 25.28µs | 3.60µs |             534.7 MB |  ±2.4% |
|                                                                                                                                        | valkey-glide<sup>1</sup> |  66.2K | 330.9K | 139.83ms | 169.32ms | 179.47ms | 186.45ms | 33.13µs | 5.38µs | 371.4 MB<sup>†</sup> |  ±1.6% |
|                                                                                                                                        | speedkey                 |  54.7K | 273.7K | 178.66ms | 211.10ms | 223.31ms | 230.86ms | 36.56µs | 3.05µs | 204.5 MB<sup>†</sup> |  ±1.6% |
| **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup><br/><sub>1 KB</sub>                                                   | **solidis**              | 296.5K | 296.5K |   7.88ms |  17.42ms |  25.33ms |  29.34ms |  6.82µs | 0.85µs |             146.7 MB |  ±3.2% |
|                                                                                                                                        | ioredis                  | 142.9K | 142.9K |  17.71ms |  29.22ms |  35.81ms |  38.85ms | 13.25µs | 1.72µs |             221.2 MB |  ±1.8% |
|                                                                                                                                        | iovalkey                 | 156.2K | 156.2K |  15.65ms |  29.60ms |  34.43ms |  37.92ms | 12.83µs | 1.81µs |             234.1 MB |  ±2.1% |
|                                                                                                                                        | node-redis               | 154.7K | 154.7K |  17.20ms |  25.10ms |  30.65ms |  33.24ms |  8.73µs | 2.39µs |             179.3 MB |  ±4.0% |
|                                                                                                                                        | valkey-glide<sup>2</sup> |  43.1K |  43.1K |  52.71ms |  81.37ms |  85.41ms |  89.92ms | 57.37µs | 2.35µs | 125.4 MB<sup>†</sup> |  ±0.7% |
|                                                                                                                                        | speedkey<sup>2</sup>     | 129.6K | 129.6K |  16.04ms |  23.31ms |  30.89ms |  34.36ms | 19.01µs | 0.99µs |  59.0 MB<sup>†</sup> |  ±2.2% |
| **Set**<br/><sup><kbd>SET</kbd></sup><br/><sub>1 KB</sub>                                                                              | **solidis**              | 349.2K | 349.2K |  25.70ms |  47.61ms |  53.35ms |  61.28ms |  6.76µs | 1.05µs |             184.5 MB |  ±3.0% |
|                                                                                                                                        | ioredis                  | 144.7K | 144.7K |  63.82ms |  90.81ms | 101.49ms | 110.37ms | 13.05µs | 1.89µs |             258.5 MB |  ±2.1% |
|                                                                                                                                        | iovalkey                 | 148.2K | 148.2K |  60.92ms |  93.87ms | 100.52ms | 104.79ms | 13.22µs | 2.00µs |             273.7 MB |  ±3.9% |
|                                                                                                                                        | node-redis               | 217.0K | 217.0K |  43.54ms |  50.53ms |  56.35ms |  68.67ms |  8.09µs | 1.65µs |             178.7 MB |  ±3.2% |
|                                                                                                                                        | valkey-glide             | 114.3K | 114.3K |  82.05ms |  95.76ms | 102.24ms | 106.77ms | 18.40µs | 2.02µs | 215.6 MB<sup>†</sup> |  ±2.7% |
|                                                                                                                                        | speedkey                 | 167.7K | 167.7K |  54.28ms |  77.77ms |  89.33ms | 102.12ms | 15.11µs | 1.06µs | 157.5 MB<sup>†</sup> |  ±4.6% |
| **Set Read**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              | 159.1K | 477.3K |  58.66ms |  89.38ms | 108.07ms | 116.20ms | 14.19µs | 2.15µs |             329.2 MB |  ±2.3% |
|                                                                                                                                        | ioredis                  |  59.5K | 178.4K | 165.10ms | 199.29ms | 208.90ms | 212.38ms | 35.94µs | 4.92µs |             392.6 MB |  ±2.7% |
|                                                                                                                                        | iovalkey                 |  59.4K | 178.1K | 165.69ms | 198.42ms | 203.06ms | 208.60ms | 36.02µs | 4.95µs |             400.4 MB |  ±1.5% |
|                                                                                                                                        | node-redis               | 102.9K | 308.6K |  94.27ms | 107.39ms | 112.13ms | 120.28ms | 15.24µs | 3.19µs |             274.9 MB |  ±2.1% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  69.2K | 207.6K | 139.22ms | 157.53ms | 163.72ms | 173.95ms | 31.16µs | 5.04µs | 320.0 MB<sup>†</sup> |  ±2.0% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  79.2K | 237.7K | 122.00ms | 136.64ms | 147.56ms | 156.95ms | 26.40µs | 2.11µs |  78.8 MB<sup>†</sup> |  ±2.0% |
| **Pipeline Mixed**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              | 164.8K | 494.5K |  56.70ms |  89.85ms | 104.52ms | 112.51ms | 13.95µs | 2.15µs |             336.8 MB |  ±2.8% |
|                                                                                                                                        | ioredis                  |  71.0K | 213.1K | 137.37ms | 163.22ms | 169.75ms | 173.36ms | 29.10µs | 4.29µs |             468.7 MB |  ±2.3% |
|                                                                                                                                        | iovalkey                 |  72.7K | 218.1K | 131.90ms | 160.92ms | 166.64ms | 169.68ms | 27.58µs | 4.42µs |             521.0 MB |  ±2.4% |
|                                                                                                                                        | node-redis               | 110.5K | 331.4K |  87.15ms |  99.28ms | 107.09ms | 114.59ms | 14.24µs | 3.13µs |             281.0 MB |  ±3.1% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  70.4K | 211.3K | 133.03ms | 161.34ms | 173.25ms | 190.62ms | 29.83µs | 5.10µs | 339.7 MB<sup>†</sup> |  ±2.7% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  82.6K | 247.9K | 118.29ms | 132.27ms | 135.91ms | 142.11ms | 25.72µs | 2.13µs |  77.5 MB<sup>†</sup> |  ±2.5% |
| **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup><br/><sub>1 KB</sub>                                          | **solidis**              | 172.5K | 517.4K |  52.75ms |  85.45ms |  95.27ms | 101.48ms | 12.94µs | 2.10µs |             308.4 MB |  ±3.1% |
|                                                                                                                                        | ioredis                  |  73.1K | 219.2K | 132.19ms | 157.81ms | 161.68ms | 170.01ms | 26.08µs | 4.09µs |             463.2 MB |  ±2.2% |
|                                                                                                                                        | iovalkey                 |  73.2K | 219.6K | 133.22ms | 155.19ms | 159.40ms | 170.40ms | 26.20µs | 4.31µs |             495.2 MB |  ±2.0% |
|                                                                                                                                        | node-redis               | 115.7K | 347.2K |  81.99ms |  93.48ms |  99.90ms | 106.39ms | 13.46µs | 3.25µs |             234.5 MB |  ±1.8% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  79.8K | 239.3K | 120.19ms | 136.70ms | 143.91ms | 151.73ms | 25.93µs | 4.95µs | 411.0 MB<sup>†</sup> |  ±2.1% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  89.1K | 267.2K | 109.64ms | 121.66ms | 126.95ms | 129.88ms | 23.38µs | 1.87µs | 127.0 MB<sup>†</sup> |  ±1.9% |
| **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              | 142.4K | 427.1K |  65.96ms |  93.88ms | 109.31ms | 115.66ms | 16.25µs | 2.39µs |             405.4 MB |  ±2.3% |
|                                                                                                                                        | ioredis                  |  58.9K | 176.6K | 163.53ms | 192.01ms | 207.45ms | 212.45ms | 36.49µs | 4.50µs |             377.0 MB |  ±2.6% |
|                                                                                                                                        | iovalkey                 |  62.1K | 186.3K | 157.09ms | 187.48ms | 204.00ms | 207.22ms | 34.13µs | 4.47µs |             411.6 MB |  ±3.3% |
|                                                                                                                                        | node-redis               |  96.8K | 290.3K |  99.48ms | 118.14ms | 124.60ms | 129.96ms | 16.44µs | 3.34µs |             331.1 MB |  ±2.0% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  59.8K | 179.4K | 160.94ms | 185.08ms | 190.43ms | 197.68ms | 35.18µs | 5.89µs | 350.5 MB<sup>†</sup> |  ±1.7% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  69.6K | 208.7K | 139.78ms | 164.20ms | 169.73ms | 179.20ms | 28.95µs | 2.17µs | 209.9 MB<sup>†</sup> |  ±1.2% |
| **Set Mutation**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              | 149.2K | 447.7K |  59.07ms | 109.49ms | 127.88ms | 134.32ms | 16.02µs | 2.39µs |             262.5 MB |  ±3.4% |
|                                                                                                                                        | ioredis                  |  52.9K | 158.7K | 183.47ms | 204.59ms | 217.81ms | 222.01ms | 37.32µs | 5.01µs |             187.9 MB |  ±5.5% |
|                                                                                                                                        | iovalkey                 |  54.8K | 164.3K | 175.85ms | 198.80ms | 207.48ms | 209.83ms | 37.76µs | 4.85µs |             307.4 MB |  ±7.6% |
|                                                                                                                                        | node-redis               | 101.6K | 304.9K |  95.75ms | 107.91ms | 113.82ms | 120.47ms | 14.77µs | 3.17µs |             230.2 MB |  ±3.2% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  68.1K | 204.4K | 143.61ms | 160.99ms | 167.06ms | 175.10ms | 30.53µs | 5.18µs | 342.8 MB<sup>†</sup> |  ±1.8% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  89.6K | 268.8K | 109.25ms | 120.56ms | 125.93ms | 131.43ms | 23.52µs | 1.80µs | 117.4 MB<sup>†</sup> |  ±2.2% |
| **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup><br/><sub>1 KB</sub>                                                       | **solidis**              | 148.4K | 296.7K |  65.35ms |  85.77ms | 102.86ms | 111.47ms | 15.58µs | 1.85µs |             355.7 MB |  ±3.2% |
|                                                                                                                                        | ioredis                  |  62.4K | 124.9K | 159.02ms | 178.00ms | 187.55ms | 189.48ms | 38.52µs | 4.22µs |             399.9 MB |  ±2.6% |
|                                                                                                                                        | iovalkey                 |  68.6K | 137.1K | 144.45ms | 170.90ms | 179.89ms | 195.27ms | 31.77µs | 3.87µs |             445.3 MB |  ±2.0% |
|                                                                                                                                        | node-redis               | 102.3K | 204.6K |  94.45ms | 113.72ms | 151.61ms | 174.21ms | 16.68µs | 2.88µs |             307.2 MB |  ±5.9% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  62.5K | 125.0K | 156.23ms | 176.67ms | 181.75ms | 191.26ms | 36.39µs | 4.86µs | 280.7 MB<sup>†</sup> |  ±2.7% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  72.2K | 144.4K | 133.65ms | 159.67ms | 167.13ms | 172.51ms | 28.04µs | 2.18µs | 169.9 MB<sup>†</sup> |  ±1.8% |
| **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup><br/><sub>1 KB</sub>                                                         | **solidis**              | 265.7K | 531.3K |  33.75ms |  53.21ms |  60.98ms |  72.59ms |  9.27µs | 1.52µs |             253.6 MB |  ±2.3% |
|                                                                                                                                        | ioredis                  | 124.2K | 248.3K |  73.75ms | 113.98ms | 122.37ms | 128.37ms | 16.98µs | 2.97µs |             350.1 MB |  ±3.5% |
|                                                                                                                                        | iovalkey                 | 129.7K | 259.4K |  71.02ms | 106.11ms | 115.05ms | 123.70ms | 16.75µs | 3.02µs |             329.2 MB |  ±4.0% |
|                                                                                                                                        | node-redis               | 187.6K | 375.3K |  50.13ms |  62.31ms |  68.19ms |  73.07ms |  9.31µs | 2.43µs |             224.5 MB |  ±2.7% |
|                                                                                                                                        | valkey-glide<sup>3</sup> | 105.7K | 211.5K |  85.65ms | 123.94ms | 141.14ms | 156.06ms | 22.11µs | 3.75µs | 371.6 MB<sup>†</sup> |  ±3.7% |
|                                                                                                                                        | speedkey<sup>3</sup>     | 134.1K | 268.2K |  72.36ms |  81.70ms |  86.22ms |  91.20ms | 16.39µs | 1.55µs | 253.1 MB<sup>†</sup> |  ±1.2% |
| **Non-Transaction**<br/><sup><kbd>SET PX</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                | **solidis**              | 195.1K | 390.2K |  47.09ms |  76.79ms |  91.10ms | 100.14ms | 11.58µs | 1.64µs |             272.6 MB |  ±2.1% |
|                                                                                                                                        | ioredis                  |  84.6K | 169.2K | 115.28ms | 139.93ms | 143.78ms | 151.76ms | 22.52µs | 3.14µs |             394.5 MB |  ±1.5% |
|                                                                                                                                        | iovalkey                 |  85.4K | 170.7K | 114.26ms | 133.99ms | 137.97ms | 139.74ms | 22.60µs | 3.29µs |             416.8 MB |  ±1.8% |
|                                                                                                                                        | node-redis               | 137.8K | 275.6K |  69.63ms |  80.19ms |  85.10ms |  89.83ms | 11.78µs | 2.48µs |             229.4 MB |  ±3.1% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  83.3K | 166.5K | 111.95ms | 131.98ms | 141.72ms | 151.19ms | 26.36µs | 4.22µs | 312.4 MB<sup>†</sup> |  ±1.6% |
|                                                                                                                                        | speedkey<sup>3</sup>     | 101.6K | 203.2K |  96.47ms | 108.44ms | 114.75ms | 118.98ms | 21.04µs | 1.86µs | 192.9 MB<sup>†</sup> |  ±2.7% |
| **Hash Mutation**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup><br/><sub>1 KB</sub>                                 | **solidis**              | 125.3K | 375.9K |  72.10ms | 104.19ms | 116.55ms | 125.46ms | 18.58µs | 2.35µs |             401.5 MB |  ±1.6% |
|                                                                                                                                        | ioredis                  |  53.6K | 160.7K | 184.97ms | 213.79ms | 231.28ms | 239.09ms | 46.19µs | 5.24µs |             443.1 MB |  ±1.4% |
|                                                                                                                                        | iovalkey                 |  57.4K | 172.1K | 173.57ms | 191.80ms | 198.37ms | 203.73ms | 44.60µs | 5.45µs |             440.4 MB |  ±1.4% |
|                                                                                                                                        | node-redis               |  88.6K | 265.7K | 108.94ms | 127.09ms | 135.08ms | 144.21ms | 18.75µs | 3.42µs |             321.1 MB |  ±3.7% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  51.3K | 153.8K | 190.19ms | 214.66ms | 220.16ms | 229.51ms | 42.00µs | 6.64µs | 336.7 MB<sup>†</sup> |  ±2.6% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  58.8K | 176.3K | 163.64ms | 193.34ms | 224.32ms | 272.11ms | 33.75µs | 2.55µs | 191.0 MB<sup>†</sup> |  ±3.8% |
| **List Range**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup><br/><sub>1 KB</sub>                                  | **solidis**              | 129.0K | 386.9K |  70.95ms | 105.17ms | 111.57ms | 117.66ms | 18.22µs | 2.40µs |             406.7 MB |  ±2.1% |
|                                                                                                                                        | ioredis                  |  54.6K | 163.9K | 181.76ms | 211.39ms | 231.15ms | 239.05ms | 45.43µs | 5.06µs |             446.9 MB |  ±3.0% |
|                                                                                                                                        | iovalkey                 |  56.3K | 169.0K | 178.10ms | 195.61ms | 202.96ms | 209.65ms | 43.73µs | 5.30µs |             421.7 MB |  ±1.4% |
|                                                                                                                                        | node-redis               |  92.3K | 277.0K | 104.85ms | 128.49ms | 135.34ms | 143.18ms | 18.25µs | 3.31µs |             317.4 MB |  ±3.5% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  57.7K | 173.1K | 166.52ms | 191.45ms | 204.21ms | 219.41ms | 38.77µs | 5.57µs | 301.5 MB<sup>†</sup> |  ±2.0% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  71.9K | 215.7K | 134.82ms | 161.35ms | 175.46ms | 210.47ms | 29.05µs | 2.32µs | 179.3 MB<sup>†</sup> |  ±2.4% |
| **Hash Round-Trip**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup><br/><sub>1 KB</sub>                              | **solidis**              | 144.4K | 433.3K |  63.82ms |  89.03ms | 104.16ms | 110.40ms | 16.63µs | 2.20µs |             373.9 MB |  ±1.7% |
|                                                                                                                                        | ioredis                  |  66.4K | 199.1K | 144.32ms | 176.34ms | 180.65ms | 184.65ms | 31.88µs | 4.26µs |             502.2 MB |  ±2.3% |
|                                                                                                                                        | iovalkey                 |  69.0K | 206.9K | 139.04ms | 165.19ms | 172.18ms | 179.52ms | 33.04µs | 4.62µs |             515.2 MB |  ±2.4% |
|                                                                                                                                        | node-redis               | 104.0K | 312.1K |  92.23ms | 106.01ms | 110.45ms | 113.07ms | 16.33µs | 3.23µs |             339.7 MB |  ±2.6% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  61.1K | 183.4K | 156.83ms | 185.36ms | 191.94ms | 196.77ms | 34.83µs | 5.55µs | 325.1 MB<sup>†</sup> |  ±2.9% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  66.9K | 200.6K | 145.07ms | 168.00ms | 178.83ms | 189.75ms | 31.57µs | 2.49µs | 167.0 MB<sup>†</sup> |  ±2.1% |
| **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup><br/><sub>1 KB</sub>                                        | **solidis**              | 140.8K | 422.4K |  65.05ms | 101.30ms | 114.95ms | 119.90ms | 15.94µs | 2.48µs |             392.2 MB |  ±2.3% |
|                                                                                                                                        | ioredis                  |  58.8K | 176.5K | 167.84ms | 192.04ms | 199.59ms | 210.77ms | 32.47µs | 4.30µs |             462.3 MB |  ±2.3% |
|                                                                                                                                        | iovalkey                 |  59.3K | 177.9K | 164.58ms | 192.50ms | 200.96ms | 205.78ms | 30.75µs | 4.48µs |             499.8 MB |  ±1.2% |
|                                                                                                                                        | node-redis               | 106.6K | 319.9K |  90.20ms | 101.36ms | 108.10ms | 116.93ms | 15.21µs | 3.39µs |             330.5 MB |  ±2.1% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  54.0K | 162.0K | 172.55ms | 211.16ms | 222.84ms | 239.99ms | 38.90µs | 6.24µs | 392.9 MB<sup>†</sup> |  ±1.3% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  55.5K | 166.4K | 173.53ms | 204.52ms | 214.02ms | 218.42ms | 34.92µs | 2.88µs | 205.7 MB<sup>†</sup> |  ±1.1% |
| **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIG GET</kbd></sup><br/><sub>1 KB</sub>                                             | **solidis**              | 224.1K | 448.2K |  39.09ms |  71.97ms |  82.95ms |  95.84ms | 10.59µs | 1.66µs |             287.4 MB |  ±2.3% |
|                                                                                                                                        | ioredis<sup>4</sup>      | 111.8K | 223.7K |  82.88ms | 124.81ms | 133.86ms | 138.06ms | 17.14µs | 2.35µs |             275.8 MB |  ±1.8% |
|                                                                                                                                        | iovalkey<sup>4</sup>     | 115.3K | 230.6K |  78.61ms | 117.28ms | 122.82ms | 127.81ms | 17.09µs | 2.48µs |             308.0 MB |  ±1.9% |
|                                                                                                                                        | node-redis               | 176.2K | 352.3K |  52.97ms |  72.09ms |  81.40ms |  90.86ms | 10.44µs | 2.37µs |             243.2 MB |  ±3.5% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  91.0K | 181.9K |  99.90ms | 142.04ms | 162.74ms | 169.83ms | 25.69µs | 4.23µs | 386.5 MB<sup>†</sup> |  ±2.1% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  97.0K | 194.0K |  99.86ms | 112.78ms | 118.24ms | 133.20ms | 21.16µs | 2.03µs | 231.4 MB<sup>†</sup> |  ±1.5% |
| **List Mutation**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup><br/><sub>1 KB</sub> | **solidis**              | 107.3K | 536.7K |  86.97ms | 119.97ms | 154.37ms | 166.19ms | 22.05µs | 3.13µs |             420.1 MB |  ±1.1% |
|                                                                                                                                        | ioredis                  |  40.1K | 200.7K | 248.36ms | 271.40ms | 288.72ms | 296.80ms | 56.42µs | 8.87µs |             434.1 MB |  ±1.5% |
|                                                                                                                                        | iovalkey                 |  40.7K | 203.6K | 243.12ms | 260.60ms | 268.22ms | 275.42ms | 56.47µs | 8.69µs |             436.1 MB |  ±1.5% |
|                                                                                                                                        | node-redis               |  88.2K | 440.8K | 108.81ms | 128.74ms | 134.71ms | 143.35ms | 20.55µs | 2.24µs |             365.1 MB |  ±2.8% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  48.6K | 243.2K | 202.81ms | 225.68ms | 234.38ms | 240.85ms | 43.87µs | 7.01µs | 338.4 MB<sup>†</sup> |  ±1.8% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  57.0K | 285.2K | 169.94ms | 192.97ms | 217.41ms | 261.83ms | 36.36µs | 2.69µs | 106.5 MB<sup>†</sup> |  ±2.4% |
| **Get**<br/><sup><kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                                              | **solidis**              | 350.1K | 350.1K |  26.72ms |  38.34ms |  43.07ms |  48.51ms |  6.36µs | 0.84µs |             112.6 MB |  ±4.5% |
|                                                                                                                                        | ioredis                  | 192.0K | 192.0K |  47.08ms |  75.40ms |  88.34ms |  92.85ms | 10.18µs | 1.60µs |             274.0 MB |  ±2.6% |
|                                                                                                                                        | iovalkey                 | 189.2K | 189.2K |  47.62ms |  79.35ms |  91.36ms |  96.68ms | 10.43µs | 1.73µs |             298.2 MB |  ±1.7% |
|                                                                                                                                        | node-redis               | 322.8K | 322.8K |  27.91ms |  42.98ms |  51.75ms |  68.03ms |  7.47µs | 0.96µs |              86.2 MB |  ±5.7% |
|                                                                                                                                        | valkey-glide             | 112.0K | 112.0K |  80.80ms | 139.17ms | 159.95ms | 174.48ms | 19.70µs | 1.24µs |  81.0 MB<sup>†</sup> |  ±2.9% |
|                                                                                                                                        | speedkey                 | 177.6K | 177.6K |  52.23ms |  68.85ms |  80.90ms |  90.14ms | 16.21µs | 1.18µs |  17.8 MB<sup>†</sup> |  ±2.7% |

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
| Repeats                    | 10                                                                                                 |
| Cooldown                   | 300ms                                                                                              |
| Date                       | 2026-10-05 15:52:42 UTC                                                                            |

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
- Clients run with **command timeouts, ready checks and reconnects off** and no pipelining limit. Valkey GLIDE and speedkey cannot turn reconnects off and wait up to 10 minutes per request. ioredis and iovalkey auto-pipeline; Valkey GLIDE and speedkey decode replies as bytes over RESP2.
- A result whose client could not run a benchmark the same way is **numbered** and explained below the table.
- Compared: every Node.js TCP client with 1,000+ weekly npm downloads that installs without compiling and keeps binary values. Left out: redis-fast-driver (native build), tedis (string values) and HTTP clients such as @upstash/redis. Valkey GLIDE has no Windows build.

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
- Pushes such as tracking invalidations never take a command's reply
- `bigint` past `Number.MAX_SAFE_INTEGER`: automatic in raw replies, `{ bigint: true }` for INCR, INCRBY, DECR, DECRBY, HINCRBY, BITFIELD and BITFIELD_RO
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
- Command errors mask the argument text the server quotes back
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
client.on('close', (error) => {});                 // Connection lost (reconnects when autoReconnect and it had been ready)
client.on('reconnecting', (attempt, delay) => {}); // Before every reconnect attempt
client.on('reconnected', () => {});                // Re-established after disconnect
client.on('end', () => {});                        // Client quit
client.on('error', (error) => {});                 // Non-fatal error (process.emitWarning() without a listener)
client.on('drain', () => {});                      // Write buffer drained
client.on('message', (channel, message) => {});    // Pub/Sub message
client.on('pmessage', (pattern, channel, message) => {});
client.on('smessage', (channel, message) => {});   // Shard channel
client.on('subscribe', (channel, count) => {});    // Also psubscribe, ssubscribe and each unsubscribe event
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
| `SolidisClientError`     | Invalid `uri`, not ready in time, refused handshake, quit, throwing event listener          |
| `SolidisConnectionError` | Connect failure or timeout, invalid port, lost connection, retries spent, refusal           |
| `SolidisRequesterError`  | Command timeout, unsent command on a lost connection, malformed or refused `send()` command |
| `SolidisParserError`     | Malformed RESP, oversized bulk string or line, nesting past 512 levels                      |
| `SolidisPubSubError`     | Malformed Pub/Sub event, throwing Pub/Sub or push listener                                  |

> [!NOTE]
>
> - Errors for arguments of the declared types are `SolidisError`s linked by the standard `cause`.
> - Messages add the command name (`[INCR] ERR ...`), not its arguments. Quoted text found in an argument becomes `'***'` in the message and in `cause`, and a Lua error is masked from its first quote. Unquoted echoes stay: GEOADD coordinates, `redis.error_reply()` text, a function name in FUNCTION LOAD.
> - Messages longer than 4,096 characters are cut, and a cut message that masks anything is masked to its end.
> - Arguments are checked by declared type only. From JavaScript, a string for an array, an array for an object or ioredis-style `set(key, value, 'EX', 10)` builds a different command. Field records accept objects only.
> - ESM and CJS clients and commands mix, but each build has its own error classes, so `instanceof` matches its own build only.
> - TS.MADD, BF.MADD and BF.INSERT return a rejected item as a `RespError` in their result.
> - Error replies in the raw results of `send()`, `pipeline()` and `exec()` keep the server's text.

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

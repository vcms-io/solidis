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

- Deadline: `commandTimeout` plus the blocking timeout; none when it blocks forever or `commandTimeout` is `0`.
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

Option types accept only the option combinations the command accepts: one of NX and XX, one of BYSCORE and BYLEX, no WITHSCORES with BYLEX, and so on. Lists and records of items are not checked: an empty one is sent as it is, except that `latencyReset([])`, `commandDocs([])` and `clientTracking()` with `prefixes: []` reject, since they would act on everything.

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

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" /> Up to 5.1x faster than other Node.js Redis clients <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Rocket.png?raw=true" alt="Rocket" width="25" height="25" />

**Fastest in 19 of 19 benchmarks against 5 clients**

<sub>linux x64 · Node.js v22.23.3 · Redis 8.10.2 · 2026-10-08</sub>

#### Leaderboard

|                                                                                                                                                                                        | Client       | Version |  Fastest in | Throughput ↑ | CPU / op ↓ |     Peak memory ↓ |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------- | :------ | ----------: | -----------: | ---------: | ----------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **solidis**  | 0.5.0   | **19** / 19 |    **1.00x** |  **1.00x** |         **1.00x** |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | node-redis   | 6.3.0   |      0 / 19 |        0.73x |      1.10x |             0.88x |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | speedkey     | 0.4.2   |      0 / 19 |        0.49x |      2.03x | 0.40x<sup>†</sup> |
|                                                                                                                                                                                     4. | iovalkey     | 0.4.0   |      0 / 19 |        0.43x |      2.21x |             1.35x |
|                                                                                                                                                                                     5. | ioredis      | 6.0.0   |      0 / 19 |        0.42x |      2.24x |             1.28x |
|                                                                                                                                                                                     6. | valkey-glide | 2.5.3   |      0 / 19 |        0.39x |      2.54x | 0.94x<sup>†</sup> |

<sub>Geometric means over all benchmarks, relative to `solidis` · <sup>†</sup> Native memory not counted</sub>

#### Operations per Second

<sub>100,000 operations × 10,000 concurrency · 1 KB payload · 10 repeats</sub>

|                                                                                                                                                                                        | Benchmark                                                                                                          | **solidis** |           ioredis |          iovalkey | node-redis |      valkey-glide |          speedkey |                                                                                                                                                                          Lead                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------- | ----------: | ----------------: | ----------------: | ---------: | ----------------: | ----------------: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/1st%20Place%20Medal.png?raw=true" alt="1st Place Medal" width="20" height="20" /> | **Transaction**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup>                                     |  **100.7K** |             23.7K |             24.7K |      51.3K | 38.8K<sup>1</sup> |             35.9K | **2.0x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/2nd%20Place%20Medal.png?raw=true" alt="2nd Place Medal" width="20" height="20" /> | **Transaction Mixed**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup>                                                 |   **65.9K** |             13.0K |             13.8K |      35.2K | 20.6K<sup>1</sup> |             25.2K | **1.9x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
| <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Activities/3rd%20Place%20Medal.png?raw=true" alt="3rd Place Medal" width="20" height="20" /> | **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup>                                                   |  **157.8K** |             75.8K |             83.9K |      89.9K | 24.8K<sup>2</sup> | 68.0K<sup>2</sup> | **1.8x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /><img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" /> |
|                                                                                                                                                                                     4. | **Set Mutation**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup>                               |   **99.2K** |             36.6K |             37.0K |      65.7K | 43.4K<sup>3</sup> | 60.8K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     5. | **Pipeline Mixed**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup>                                    |   **78.9K** |             35.9K |             35.8K |      52.8K | 34.8K<sup>3</sup> | 41.6K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     6. | **Set**<br/><sup><kbd>SET</kbd></sup>                                                                              |  **152.4K** |             79.4K |             79.4K |     102.3K |             60.6K |             81.5K |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     7. | **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup>                                          |   **95.3K** |             45.9K |             44.9K |      65.6K | 43.6K<sup>3</sup> | 55.5K<sup>3</sup> |                                                                                    **1.5x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     8. | **Non-Transaction**<br/><sup><kbd>SET PX</kbd> <kbd>GET</kbd></sup>                                                |   **97.5K** |             43.5K |             44.6K |      70.7K | 38.5K<sup>3</sup> | 49.1K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                     9. | **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup>                                                       |  **103.5K** |             46.4K |             49.8K |      75.8K | 43.4K<sup>3</sup> | 62.8K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    10. | **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup>                                    |   **88.4K** |             36.7K |             38.7K |      65.0K | 36.4K<sup>3</sup> | 47.1K<sup>3</sup> |                                                                                    **1.4x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    11. | **Set Read**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup>                               |   **73.8K** |             31.1K |             31.2K |      55.4K | 32.7K<sup>3</sup> | 39.3K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    12. | **Hash Mutation**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup>                                 |   **83.3K** |             35.7K |             38.1K |      65.3K | 33.3K<sup>3</sup> | 39.9K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    13. | **Hash Round-Trip**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup>                              |   **92.5K** |             42.1K |             44.5K |      73.6K | 38.0K<sup>3</sup> | 41.9K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    14. | **List Range**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup>                                  |   **69.9K** |             30.2K |             32.1K |      55.8K | 30.6K<sup>3</sup> | 38.8K<sup>3</sup> |                                                                                    **1.3x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/Fire.png?raw=true" alt="Fire" width="16" height="16" />                                                                                     |
|                                                                                                                                                                                    15. | **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup>                                        |   **63.6K** |             30.7K |             30.8K |      53.9K | 25.3K<sup>3</sup> | 27.3K<sup>3</sup> |                                                                           **1.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    16. | **List Mutation**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup> |   **60.9K** |             21.6K |             22.0K |      52.0K | 25.3K<sup>3</sup> | 30.8K<sup>3</sup> |                                                                           **1.2x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    17. | **Get**<br/><sup><kbd>GET</kbd></sup>                                                                              |  **184.6K** |            105.5K |            106.4K |     161.2K |             67.9K |             89.5K |                                                                           **1.1x** <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="16" height="16" />                                                                            |
|                                                                                                                                                                                    18. | **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIG GET</kbd></sup>                                             |  **119.2K** | 54.7K<sup>4</sup> | 56.8K<sup>4</sup> |     116.4K | 48.2K<sup>3</sup> | 51.3K<sup>3</sup> |                                                                                                                                                                        **1.0x**                                                                                                                                                                         |
|                                                                                                                                                                                    19. | **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup>                                                         |  **160.2K** |             81.2K |             81.1K |     158.4K | 65.5K<sup>3</sup> | 81.5K<sup>3</sup> |                                                                                                                                                                        **1.0x**                                                                                                                                                                         |

<sub>Medians over the repeats · fastest in bold · Lead = `solidis` ÷ the fastest other client</sub>

<details>
<summary><sub>Notes</sub></summary>

<sub><sup>1</sup> Sends MULTI/EXEC transactions as an atomic batch</sub><br/>
<sub><sup>2</sup> Needs RESP3 for Pub/Sub</sub><br/>
<sub><sup>3</sup> Sends each operation as one batch to keep command order</sub><br/>
<sub><sup>4</sup> Does not auto-pipeline INFO</sub>

</details>

</div>

<details>
<summary>&nbsp;&nbsp;<b>Detailed metrics</b></summary>

| Benchmark                                                                                                                              | Library                  |  ops/s | cmds/s |      p50 |      p95 |       p99 |     p99.9 |   CPU/op |   GC/op |               Memory | Spread |
| :------------------------------------------------------------------------------------------------------------------------------------- | :----------------------- | -----: | -----: | -------: | -------: | --------: | --------: | -------: | ------: | -------------------: | -----: |
| **Transaction**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                     | **solidis**              | 100.7K | 503.6K |  89.62ms | 160.89ms |  187.93ms |  201.56ms |  19.50µs |  3.33µs |             301.2 MB |  ±3.1% |
|                                                                                                                                        | ioredis                  |  23.7K | 118.4K | 408.16ms | 493.31ms |  569.04ms |  633.58ms |  72.91µs |  9.91µs |             645.0 MB |  ±3.8% |
|                                                                                                                                        | iovalkey                 |  24.7K | 123.4K | 385.78ms | 469.66ms |  640.65ms |  681.94ms |  72.37µs | 10.44µs |             688.9 MB |  ±4.6% |
|                                                                                                                                        | node-redis               |  51.3K | 256.4K | 180.99ms | 241.51ms |  262.25ms |  283.96ms |  37.55µs |  6.06µs |             541.2 MB |  ±3.2% |
|                                                                                                                                        | valkey-glide<sup>1</sup> |  38.8K | 193.8K | 238.38ms | 299.82ms |  313.65ms |  331.55ms |  53.28µs |  9.07µs | 379.3 MB<sup>†</sup> |  ±1.8% |
|                                                                                                                                        | speedkey                 |  35.9K | 179.5K | 277.21ms | 342.64ms |  364.43ms |  373.82ms |  59.37µs |  5.33µs | 204.3 MB<sup>†</sup> |  ±2.7% |
| **Transaction Mixed**<br/><sup><kbd>SET</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                 | **solidis**              |  65.9K | 395.2K | 140.12ms | 201.08ms |  237.46ms |  284.97ms |  31.54µs |  4.60µs |             356.4 MB |  ±2.3% |
|                                                                                                                                        | ioredis                  |  13.0K |  78.0K | 746.91ms | 912.98ms | 1034.59ms | 1075.32ms | 119.43µs | 12.04µs |             671.7 MB |  ±3.5% |
|                                                                                                                                        | iovalkey                 |  13.8K |  82.7K | 692.32ms | 855.17ms |  930.75ms | 1092.18ms | 114.38µs | 12.96µs |             724.4 MB |  ±4.3% |
|                                                                                                                                        | node-redis               |  35.2K | 211.3K | 264.23ms | 359.42ms |  369.14ms |  379.24ms |  54.67µs |  8.05µs |             492.9 MB |  ±0.8% |
|                                                                                                                                        | valkey-glide<sup>1</sup> |  20.6K | 123.3K | 486.44ms | 527.04ms |  541.73ms |  550.40ms | 104.77µs | 14.67µs | 364.7 MB<sup>†</sup> |  ±0.7% |
|                                                                                                                                        | speedkey                 |  25.2K | 151.2K | 381.09ms | 523.65ms |  570.81ms |  587.39ms |  84.36µs |  6.29µs | 216.3 MB<sup>†</sup> |  ±7.9% |
| **Pub/Sub**<br/><sup><kbd>PUBLISH</kbd> <kbd>MESSAGE</kbd></sup><br/><sub>1 KB</sub>                                                   | **solidis**              | 157.8K | 157.8K |  14.19ms |  30.18ms |   53.59ms |   58.67ms |  12.57µs |  1.66µs |             152.1 MB |  ±3.1% |
|                                                                                                                                        | ioredis                  |  75.8K |  75.8K |  31.61ms |  52.96ms |   69.93ms |   77.67ms |  24.97µs |  3.24µs |             266.5 MB |  ±2.4% |
|                                                                                                                                        | iovalkey                 |  83.9K |  83.9K |  30.02ms |  50.37ms |   56.81ms |   66.56ms |  23.90µs |  3.60µs |             284.3 MB |  ±2.7% |
|                                                                                                                                        | node-redis               |  89.9K |  89.9K |  29.30ms |  46.92ms |   61.58ms |   79.30ms |  14.90µs |  4.60µs |             176.7 MB |  ±6.4% |
|                                                                                                                                        | valkey-glide<sup>2</sup> |  24.8K |  24.8K |  96.71ms | 146.53ms |  159.84ms |  311.67ms | 101.62µs |  4.24µs | 111.7 MB<sup>†</sup> |  ±2.3% |
|                                                                                                                                        | speedkey<sup>2</sup>     |  68.0K |  68.0K |  33.34ms |  51.49ms |   65.81ms |   75.61ms |  31.70µs |  1.51µs |  54.6 MB<sup>†</sup> |  ±1.5% |
| **Set Mutation**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SREM</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              |  99.2K | 297.5K |  92.36ms | 136.70ms |  161.30ms |  174.51ms |  22.82µs |  3.71µs |             275.2 MB |  ±1.6% |
|                                                                                                                                        | ioredis                  |  36.6K | 109.9K | 271.34ms | 295.79ms |  312.23ms |  315.78ms |  56.54µs |  7.67µs |             277.1 MB |  ±1.5% |
|                                                                                                                                        | iovalkey                 |  37.0K | 111.1K | 271.05ms | 303.97ms |  333.62ms |  338.95ms |  57.32µs |  7.65µs |             320.4 MB |  ±4.3% |
|                                                                                                                                        | node-redis               |  65.7K | 197.0K | 146.10ms | 179.20ms |  189.35ms |  200.47ms |  23.34µs |  5.33µs |             244.2 MB |  ±2.7% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  43.4K | 130.3K | 221.61ms | 252.08ms |  260.20ms |  266.54ms |  49.84µs |  7.37µs | 349.7 MB<sup>†</sup> |  ±1.5% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  60.8K | 182.5K | 159.42ms | 195.46ms |  199.81ms |  205.00ms |  36.52µs |  2.81µs |  90.2 MB<sup>†</sup> |  ±8.0% |
| **Pipeline Mixed**<br/><sup><kbd>SET</kbd> <kbd>INCR</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              |  78.9K | 236.7K | 114.56ms | 192.41ms |  225.44ms |  241.48ms |  27.68µs |  5.21µs |             344.8 MB |  ±4.5% |
|                                                                                                                                        | ioredis                  |  35.9K | 107.8K | 264.87ms | 331.38ms |  343.45ms |  346.09ms |  56.96µs |  8.47µs |             475.6 MB |  ±1.7% |
|                                                                                                                                        | iovalkey                 |  35.8K | 107.5K | 265.28ms | 333.22ms |  346.68ms |  351.72ms |  58.40µs |  9.46µs |             569.1 MB |  ±1.6% |
|                                                                                                                                        | node-redis               |  52.8K | 158.5K | 179.20ms | 222.02ms |  241.53ms |  279.57ms |  30.73µs |  7.69µs |             270.7 MB |  ±2.5% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  34.8K | 104.3K | 270.86ms | 324.85ms |  337.63ms |  347.35ms |  59.71µs | 10.25µs | 336.4 MB<sup>†</sup> |  ±1.8% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  41.6K | 124.8K | 233.59ms | 268.75ms |  282.41ms |  305.11ms |  52.51µs |  4.41µs |  77.0 MB<sup>†</sup> |  ±4.2% |
| **Set**<br/><sup><kbd>SET</kbd></sup><br/><sub>1 KB</sub>                                                                              | **solidis**              | 152.4K | 152.4K |  57.05ms |  98.72ms |  126.39ms |  145.74ms |  15.42µs |  2.56µs |             262.2 MB |  ±1.2% |
|                                                                                                                                        | ioredis                  |  79.4K |  79.4K | 113.90ms | 186.13ms |  198.77ms |  212.15ms |  24.91µs |  3.51µs |             259.0 MB |  ±1.6% |
|                                                                                                                                        | iovalkey                 |  79.4K |  79.4K | 114.73ms | 176.77ms |  189.84ms |  229.35ms |  25.52µs |  3.71µs |             274.3 MB |  ±7.0% |
|                                                                                                                                        | node-redis               | 102.3K | 102.3K |  90.87ms | 120.81ms |  130.57ms |  139.44ms |  15.75µs |  3.93µs |             178.9 MB |  ±3.8% |
|                                                                                                                                        | valkey-glide             |  60.6K |  60.6K | 153.75ms | 182.90ms |  190.55ms |  196.51ms |  35.87µs |  4.09µs | 216.5 MB<sup>†</sup> |  ±1.2% |
|                                                                                                                                        | speedkey                 |  81.5K |  81.5K | 119.08ms | 137.45ms |  145.12ms |  156.49ms |  29.43µs |  1.74µs | 101.3 MB<sup>†</sup> |  ±6.2% |
| **Expire**<br/><sup><kbd>SET</kbd> <kbd>EXPIRE</kbd> <kbd>TTL</kbd></sup><br/><sub>1 KB</sub>                                          | **solidis**              |  95.3K | 286.0K |  94.73ms | 157.68ms |  195.93ms |  321.33ms |  22.40µs |  4.33µs |             331.4 MB |  ±7.3% |
|                                                                                                                                        | ioredis                  |  45.9K | 137.8K | 204.06ms | 263.53ms |  272.33ms |  279.61ms |  43.34µs |  7.19µs |             448.5 MB |  ±1.3% |
|                                                                                                                                        | iovalkey                 |  44.9K | 134.6K | 215.23ms | 278.96ms |  306.87ms |  322.89ms |  44.88µs |  7.97µs |             484.6 MB |  ±5.5% |
|                                                                                                                                        | node-redis               |  65.6K | 196.8K | 142.20ms | 180.82ms |  191.95ms |  203.52ms |  24.44µs |  6.71µs |             248.7 MB |  ±4.1% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  43.6K | 130.7K | 217.28ms | 256.20ms |  267.41ms |  276.35ms |  46.83µs |  8.79µs | 409.8 MB<sup>†</sup> |  ±1.9% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  55.5K | 166.5K | 186.55ms | 208.57ms |  218.95ms |  238.14ms |  39.66µs |  3.60µs | 100.2 MB<sup>†</sup> |  ±5.9% |
| **Non-Transaction**<br/><sup><kbd>SET PX</kbd> <kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                | **solidis**              |  97.5K | 194.9K |  91.85ms | 164.61ms |  196.08ms |  215.22ms |  21.96µs |  3.85µs |             276.5 MB |  ±2.0% |
|                                                                                                                                        | ioredis                  |  43.5K |  87.0K | 215.33ms | 293.80ms |  300.29ms |  316.82ms |  46.17µs |  6.15µs |             373.8 MB |  ±1.7% |
|                                                                                                                                        | iovalkey                 |  44.6K |  89.1K | 215.02ms | 280.90ms |  301.06ms |  307.90ms |  44.01µs |  6.49µs |             394.2 MB |  ±1.8% |
|                                                                                                                                        | node-redis               |  70.7K | 141.4K | 132.98ms | 167.31ms |  178.58ms |  191.14ms |  23.08µs |  5.44µs |             229.7 MB |  ±1.5% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  38.5K |  76.9K | 241.10ms | 287.24ms |  299.65ms |  310.94ms |  54.65µs |  8.49µs | 314.1 MB<sup>†</sup> |  ±1.4% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  49.1K |  98.2K | 197.52ms | 263.74ms |  273.51ms |  283.53ms |  43.93µs |  3.58µs | 167.4 MB<sup>†</sup> |  ±9.6% |
| **Multi-Key**<br/><sup><kbd>MSET</kbd> <kbd>MGET</kbd></sup><br/><sub>1 KB</sub>                                                       | **solidis**              | 103.5K | 206.9K |  91.13ms | 124.77ms |  143.89ms |  162.67ms |  20.81µs |  3.21µs |             347.9 MB |  ±3.9% |
|                                                                                                                                        | ioredis                  |  46.4K |  92.7K | 218.12ms | 237.36ms |  245.38ms |  261.68ms |  49.90µs |  5.82µs |             416.9 MB |  ±2.3% |
|                                                                                                                                        | iovalkey                 |  49.8K |  99.6K | 200.51ms | 230.73ms |  241.00ms |  270.13ms |  43.07µs |  5.60µs |             431.2 MB |  ±2.8% |
|                                                                                                                                        | node-redis               |  75.8K | 151.6K | 125.73ms | 160.24ms |  178.72ms |  193.97ms |  23.79µs |  5.05µs |             320.8 MB |  ±2.0% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  43.4K |  86.7K | 218.42ms | 256.38ms |  271.15ms |  276.57ms |  49.76µs |  7.07µs | 279.2 MB<sup>†</sup> |  ±1.7% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  62.8K | 125.6K | 158.59ms | 196.65ms |  205.95ms |  210.81ms |  34.60µs |  3.16µs | 170.8 MB<sup>†</sup> |  ±3.6% |
| **Sorted Set**<br/><sup><kbd>ZADD</kbd> <kbd>ZRANGE</kbd> <kbd>ZREM</kbd></sup><br/><sub>1 KB</sub>                                    | **solidis**              |  88.4K | 265.2K | 101.85ms | 164.10ms |  200.68ms |  230.03ms |  25.94µs |  4.01µs |             340.1 MB |  ±6.0% |
|                                                                                                                                        | ioredis                  |  36.7K | 110.0K | 273.50ms | 308.57ms |  350.07ms |  357.84ms |  57.54µs |  7.89µs |             401.2 MB |  ±3.2% |
|                                                                                                                                        | iovalkey                 |  38.7K | 116.1K | 263.77ms | 286.75ms |  292.44ms |  297.33ms |  55.86µs |  7.92µs |             389.7 MB |  ±1.7% |
|                                                                                                                                        | node-redis               |  65.0K | 195.1K | 148.87ms | 176.80ms |  185.67ms |  191.88ms |  24.39µs |  5.57µs |             282.6 MB |  ±2.8% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  36.4K | 109.3K | 260.27ms | 301.34ms |  311.14ms |  344.21ms |  55.15µs |  8.82µs | 353.2 MB<sup>†</sup> |  ±2.0% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  47.1K | 141.3K | 205.68ms | 262.68ms |  275.64ms |  278.96ms |  44.96µs |  3.55µs | 250.4 MB<sup>†</sup> |  ±5.0% |
| **Set Read**<br/><sup><kbd>SADD</kbd> <kbd>SISMEMBER</kbd> <kbd>SMEMBERS</kbd></sup><br/><sub>1 KB</sub>                               | **solidis**              |  73.8K | 221.5K | 122.83ms | 187.84ms |  222.38ms |  236.07ms |  31.21µs |  4.98µs |             328.3 MB |  ±2.9% |
|                                                                                                                                        | ioredis                  |  31.1K |  93.4K | 328.99ms | 359.85ms |  405.11ms |  435.44ms |  68.06µs |  8.82µs |             377.9 MB |  ±2.6% |
|                                                                                                                                        | iovalkey                 |  31.2K |  93.6K | 322.73ms | 357.31ms |  367.72ms |  375.85ms |  67.84µs |  9.23µs |             386.4 MB |  ±1.5% |
|                                                                                                                                        | node-redis               |  55.4K | 166.2K | 172.33ms | 210.32ms |  225.50ms |  236.42ms |  28.81µs |  6.72µs |             265.9 MB |  ±1.7% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  32.7K |  98.1K | 293.52ms | 336.99ms |  345.97ms |  352.81ms |  65.10µs |  9.33µs | 321.8 MB<sup>†</sup> |  ±1.5% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  39.3K | 117.9K | 246.92ms | 320.08ms |  334.71ms |  351.13ms |  54.67µs |  4.14µs |  79.7 MB<sup>†</sup> |  ±5.0% |
| **Hash Mutation**<br/><sup><kbd>HMSET</kbd> <kbd>HMGET</kbd> <kbd>HDEL</kbd></sup><br/><sub>1 KB</sub>                                 | **solidis**              |  83.3K | 250.0K | 109.71ms | 162.77ms |  176.26ms |  197.47ms |  27.60µs |  3.86µs |             389.4 MB |  ±3.0% |
|                                                                                                                                        | ioredis                  |  35.7K | 107.1K | 276.09ms | 308.65ms |  340.90ms |  358.32ms |  70.09µs |  7.83µs |             452.0 MB |  ±1.7% |
|                                                                                                                                        | iovalkey                 |  38.1K | 114.2K | 261.65ms | 292.94ms |  311.30ms |  318.67ms |  66.76µs |  8.01µs |             452.7 MB |  ±2.4% |
|                                                                                                                                        | node-redis               |  65.3K | 195.9K | 144.09ms | 185.38ms |  192.97ms |  198.58ms |  26.38µs |  4.66µs |             330.4 MB |  ±2.7% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  33.3K |  99.9K | 294.93ms | 330.74ms |  342.18ms |  356.41ms |  63.12µs |  9.02µs | 334.9 MB<sup>†</sup> |  ±1.3% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  39.9K | 119.8K | 243.52ms | 299.46ms |  317.91ms |  330.12ms |  52.47µs |  3.94µs | 192.1 MB<sup>†</sup> |  ±2.8% |
| **Hash Round-Trip**<br/><sup><kbd>HSET</kbd> <kbd>HGET</kbd> <kbd>HGETALL</kbd></sup><br/><sub>1 KB</sub>                              | **solidis**              |  92.5K | 277.6K |  93.68ms | 168.86ms |  202.67ms |  227.88ms |  24.99µs |  3.77µs |             377.2 MB |  ±4.3% |
|                                                                                                                                        | ioredis                  |  42.1K | 126.3K | 234.39ms | 291.05ms |  425.20ms |  445.46ms |  52.44µs |  6.74µs |             488.4 MB |  ±4.8% |
|                                                                                                                                        | iovalkey                 |  44.5K | 133.6K | 228.94ms | 275.72ms |  295.75ms |  303.14ms |  50.46µs |  6.91µs |             503.7 MB |  ±4.7% |
|                                                                                                                                        | node-redis               |  73.6K | 220.9K | 126.25ms | 172.10ms |  183.33ms |  198.16ms |  23.66µs |  4.52µs |             338.0 MB |  ±5.6% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  38.0K | 113.9K | 244.41ms | 309.66ms |  320.46ms |  329.74ms |  53.68µs |  8.00µs | 326.0 MB<sup>†</sup> |  ±2.9% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  41.9K | 125.7K | 231.40ms | 295.19ms |  313.10ms |  336.22ms |  51.63µs |  3.73µs | 167.1 MB<sup>†</sup> |  ±5.2% |
| **List Range**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LRANGE</kbd></sup><br/><sub>1 KB</sub>                                  | **solidis**              |  69.9K | 209.8K | 126.84ms | 193.98ms |  210.90ms |  244.86ms |  32.49µs |  4.96µs |             382.6 MB |  ±1.5% |
|                                                                                                                                        | ioredis                  |  30.2K |  90.6K | 328.74ms | 365.19ms |  395.65ms |  414.20ms |  83.00µs |  9.95µs |             443.3 MB |  ±1.5% |
|                                                                                                                                        | iovalkey                 |  32.1K |  96.2K | 315.71ms | 344.10ms |  355.59ms |  364.69ms |  76.27µs |  9.92µs |             488.0 MB |  ±2.2% |
|                                                                                                                                        | node-redis               |  55.8K | 167.3K | 167.00ms | 215.52ms |  224.07ms |  234.10ms |  31.38µs |  6.23µs |             327.7 MB |  ±1.1% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  30.6K |  91.7K | 317.69ms | 365.49ms |  382.91ms |  399.14ms |  70.80µs | 10.16µs | 301.8 MB<sup>†</sup> |  ±1.1% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  38.8K | 116.5K | 249.10ms | 311.48ms |  327.65ms |  333.98ms |  55.73µs |  4.81µs | 180.2 MB<sup>†</sup> |  ±4.8% |
| **Stream**<br/><sup><kbd>XADD</kbd> <kbd>XRANGE</kbd> <kbd>XLEN</kbd></sup><br/><sub>1 KB</sub>                                        | **solidis**              |  63.6K | 190.9K | 135.77ms | 213.77ms |  243.95ms |  254.15ms |  34.39µs |  6.21µs |             398.9 MB |  ±2.0% |
|                                                                                                                                        | ioredis                  |  30.7K |  92.2K | 311.12ms | 371.80ms |  382.60ms |  391.00ms |  63.08µs |  8.48µs |             481.3 MB |  ±1.8% |
|                                                                                                                                        | iovalkey                 |  30.8K |  92.3K | 313.85ms | 367.92ms |  390.06ms |  397.52ms |  62.82µs |  8.99µs |             494.3 MB |  ±2.1% |
|                                                                                                                                        | node-redis               |  53.9K | 161.8K | 176.55ms | 224.46ms |  237.40ms |  246.75ms |  30.59µs |  7.61µs |             327.2 MB |  ±2.4% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  25.3K |  76.0K | 366.32ms | 451.84ms |  495.74ms |  550.42ms |  79.44µs | 12.18µs | 388.6 MB<sup>†</sup> |  ±2.0% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  27.3K |  81.9K | 359.57ms | 441.96ms |  485.70ms |  506.40ms |  74.68µs |  6.08µs | 208.2 MB<sup>†</sup> |  ±3.3% |
| **List Mutation**<br/><sup><kbd>LPUSH</kbd> <kbd>RPUSH</kbd> <kbd>LPOP</kbd> <kbd>RPOP</kbd> <kbd>LLEN</kbd></sup><br/><sub>1 KB</sub> | **solidis**              |  60.9K | 304.6K | 152.59ms | 219.83ms |  279.90ms |  297.95ms |  34.62µs |  4.33µs |             432.5 MB |  ±4.1% |
|                                                                                                                                        | ioredis                  |  21.6K | 108.2K | 461.84ms | 487.03ms |  494.98ms |  498.10ms | 102.20µs | 15.09µs |             439.0 MB |  ±1.2% |
|                                                                                                                                        | iovalkey                 |  22.0K | 110.2K | 452.17ms | 475.01ms |  479.00ms |  481.18ms | 103.26µs | 14.99µs |             437.7 MB |  ±0.9% |
|                                                                                                                                        | node-redis               |  52.0K | 260.2K | 176.77ms | 240.68ms |  251.63ms |  262.19ms |  35.60µs |  4.14µs |             378.1 MB |  ±1.5% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  25.3K | 126.5K | 392.42ms | 431.54ms |  444.68ms |  455.07ms |  80.44µs | 11.82µs | 333.9 MB<sup>†</sup> |  ±0.8% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  30.8K | 153.8K | 319.25ms | 394.61ms |  403.21ms |  407.01ms |  70.77µs |  5.09µs | 103.1 MB<sup>†</sup> |  ±2.5% |
| **Get**<br/><sup><kbd>GET</kbd></sup><br/><sub>1 KB</sub>                                                                              | **solidis**              | 184.6K | 184.6K |  50.07ms |  81.22ms |   94.68ms |  104.98ms |  11.72µs |  1.73µs |             198.3 MB |  ±3.4% |
|                                                                                                                                        | ioredis                  | 105.5K | 105.5K |  87.33ms | 131.25ms |  144.32ms |  150.30ms |  18.58µs |  3.06µs |             284.4 MB |  ±1.6% |
|                                                                                                                                        | iovalkey                 | 106.4K | 106.4K |  87.66ms | 128.46ms |  142.94ms |  151.63ms |  19.22µs |  3.32µs |             258.2 MB |  ±2.0% |
|                                                                                                                                        | node-redis               | 161.2K | 161.2K |  54.44ms |  87.95ms |   96.01ms |  102.93ms |  14.65µs |  2.07µs |              92.0 MB |  ±2.2% |
|                                                                                                                                        | valkey-glide             |  67.9K |  67.9K | 121.54ms | 223.02ms |  293.85ms |  372.79ms |  34.61µs |  3.19µs |  83.7 MB<sup>†</sup> |  ±4.7% |
|                                                                                                                                        | speedkey                 |  89.5K |  89.5K | 107.37ms | 139.97ms |  153.29ms |  171.80ms |  25.94µs |  2.14µs |   8.5 MB<sup>†</sup> |  ±1.7% |
| **Info / Config**<br/><sup><kbd>INFO</kbd> <kbd>CONFIG GET</kbd></sup>                                                                 | **solidis**              | 119.2K | 238.3K |  73.49ms | 138.66ms |  159.23ms |  169.53ms |  18.48µs |  3.00µs |             302.7 MB |  ±2.3% |
|                                                                                                                                        | ioredis<sup>4</sup>      |  54.7K | 109.5K | 171.27ms | 244.90ms |  266.28ms |  284.27ms |  33.81µs |  4.89µs |             296.0 MB |  ±3.3% |
|                                                                                                                                        | iovalkey<sup>4</sup>     |  56.8K | 113.6K | 164.71ms | 231.97ms |  249.99ms |  268.53ms |  34.00µs |  5.34µs |             321.0 MB |  ±2.0% |
|                                                                                                                                        | node-redis               | 116.4K | 232.8K |  77.44ms | 127.94ms |  141.36ms |  150.06ms |  18.22µs |  2.99µs |             266.9 MB |  ±4.5% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  48.2K |  96.4K | 188.37ms | 296.58ms |  336.49ms |  368.85ms |  45.95µs |  8.22µs | 335.1 MB<sup>†</sup> |  ±5.8% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  51.3K | 102.6K | 191.51ms | 232.31ms |  249.57ms |  258.94ms |  42.04µs |  4.45µs | 203.8 MB<sup>†</sup> |  ±2.4% |
| **Counter**<br/><sup><kbd>INCR</kbd> <kbd>DECR</kbd></sup>                                                                             | **solidis**              | 160.2K | 320.4K |  55.27ms | 110.54ms |  132.27ms |  200.76ms |  12.80µs |  2.33µs |             268.4 MB |  ±4.3% |
|                                                                                                                                        | ioredis                  |  81.2K | 162.4K | 113.14ms | 177.92ms |  184.53ms |  189.74ms |  25.74µs |  4.62µs |             350.9 MB |  ±1.6% |
|                                                                                                                                        | iovalkey                 |  81.1K | 162.2K | 116.06ms | 165.65ms |  174.51ms |  180.60ms |  26.40µs |  4.85µs |             376.9 MB |  ±2.8% |
|                                                                                                                                        | node-redis               | 158.4K | 316.8K |  56.60ms |  91.51ms |  111.92ms |  152.19ms |  14.13µs |  2.34µs |             248.1 MB | ±16.5% |
|                                                                                                                                        | valkey-glide<sup>3</sup> |  65.5K | 131.0K | 142.89ms | 184.46ms |  208.37ms |  324.82ms |  32.49µs |  6.20µs | 366.3 MB<sup>†</sup> |  ±2.9% |
|                                                                                                                                        | speedkey<sup>3</sup>     |  81.5K | 163.0K | 126.68ms | 158.80ms |  173.31ms |  184.79ms |  27.58µs |  2.64µs | 276.4 MB<sup>†</sup> |  ±8.1% |

<sub><sup>†</sup> Native memory not counted</sub>

</details>

<details>
<summary>&nbsp;&nbsp;<b>Environment</b></summary>

| Parameter                  | Value                                                                                                                                                                                       |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CPU                        | AMD EPYC 7763 64-Core Processor (4 threads)<br/>AMD EPYC 9V74 80-Core Processor (4 threads)<br/>AMD EPYC 9V45 96-Core Processor (4 threads)<br/>INTEL(R) XEON(R) PLATINUM 8573C (4 threads) |
| Memory                     | 15.6 GB                                                                                                                                                                                     |
| Operating system           | linux x64 (6.17.0-1022-azure)                                                                                                                                                               |
| Node.js                    | v22.23.3                                                                                                                                                                                    |
| Server                     | Redis 8.10.2                                                                                                                                                                                |
| Clients                    | solidis 0.5.0, ioredis 6.0.0, iovalkey 0.4.0, node-redis 6.3.0, valkey-glide 2.5.3, speedkey 0.4.2                                                                                          |
| Mode                       | `autopipeline`                                                                                                                                                                              |
| Payload sizes              | 1 KB                                                                                                                                                                                        |
| Operations per sample      | 100,000                                                                                                                                                                                     |
| Warmup operations          | 1,000                                                                                                                                                                                       |
| Connections per client     | 1                                                                                                                                                                                           |
| Concurrency per connection | 10,000                                                                                                                                                                                      |
| Repeats                    | 10                                                                                                                                                                                          |
| Cooldown                   | 2500ms                                                                                                                                                                                      |
| Date                       | 2026-10-08 15:30:29 UTC                                                                                                                                                                     |

</details>

<details>
<summary>&nbsp;&nbsp;<b>Methodology</b></summary>

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

</details>

</div>

## Features

<table>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Travel%20and%20places/High%20Voltage.png?raw=true" alt="High Voltage" width="25" height="25" /> Performance

- `setImmediate` pipeline coalescing
- Linear-time incremental RESP parser
- Zero-copy views for bulk replies
- Node merges pipelines into one `writev`

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Electric%20Plug.png?raw=true" alt="Electric Plug" width="25" height="25" /> Protocol

- RESP2 and RESP3 (no streamed replies)
- All 15 RESP3 reply types
- Pushes never take a command's reply
- `bigint` past safe integers
- Binary-safe `Buffer` in and out

</td>
</tr>
<tr>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Shield.png?raw=true" alt="Shield" width="25" height="25" /> Reliability

- Auto-reconnect with jittered exponential backoff
- Commands wait for the handshake and ready check
- Restores AUTH, protocol, SELECT and subscriptions
- Aborts transactions a reconnect broke
- Timeouts per pipeline, `send()` and blocking call
- In-flight commands fail fast on faults

</td>
<td width="50%" valign="top">

### <img src="https://github.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/blob/master/Emojis/Objects/Locked.png?raw=true" alt="Locked" width="25" height="25" /> Security

- TLS (`rediss://` or the `tls` option)
- ACL username and password
- Debug entries never log arguments
- Errors mask arguments the server echoes
- Bulk size and 512-level nesting limits

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
client.on('close', (error) => {});                 // Lost; autoReconnect retries if it was ready
client.on('reconnecting', (attempt, delay) => {}); // Before every reconnect attempt
client.on('reconnected', () => {});                // Re-established after disconnect
client.on('end', () => {});                        // Client quit
client.on('error', (error) => {});                 // Non-fatal error (emitWarning() without a listener)
client.on('drain', () => {});                      // Write buffer drained
client.on('message', (channel, message) => {});    // Pub/Sub message
client.on('pmessage', (pattern, channel, message) => {});
client.on('smessage', (channel, message) => {});   // Shard channel
client.on('subscribe', (channel, count) => {});    // Also psubscribe, ssubscribe and unsubscribes
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

<details>
<summary>&nbsp;&nbsp;<b>Notes</b></summary>

- Errors for arguments of the declared types are `SolidisError`s linked by the standard `cause`.
- Messages add the command name (`[INCR] ERR ...`), not its arguments. Quoted text found in an argument becomes `'***'` in the message and in `cause`, and a Lua error is masked from its first quote. Unquoted echoes stay: GEOADD coordinates, `redis.error_reply()` text, a function name in FUNCTION LOAD.
- Messages longer than 4,096 characters are cut, and a cut message that masks anything is masked to its end.
- Arguments are checked by declared type only. From JavaScript, a string for an array, an array for an object or ioredis-style `set(key, value, 'EX', 10)` builds a different command. Field records accept objects only.
- ESM and CJS clients and commands mix, but each build has its own error classes, so `instanceof` matches its own build only.
- TS.MADD, BF.MADD and BF.INSERT return a rejected item as a `RespError` in their result.
- Error replies in the raw results of `send()`, `pipeline()` and `exec()` keep the server's text.

</details>

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

# Changelog

All notable changes to Solidis are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

This release rebuilds the client core around one guarantee: every reply reaches the request that asked for it. Sessions survive reconnects, replies have one shape across RESP2, RESP3 and module versions, and reads can return Buffers or BigInts on request.

> [!IMPORTANT]
> This release contains breaking changes. Follow [Upgrading from 0.4.x](#upgrading-from-04x) before you update.

### Highlights

- Replies can no longer reach the wrong request. RESP3 pushes, RESP2 data shaped like pub/sub messages, timed-out blocking commands and reconnects all keep requests and replies paired.
- A reconnect restores the session (authentication, protocol, selected database and subscriptions) before any queued command runs, with exponential, jittered backoff, and refuses to commit a transaction whose `WATCH` or `MULTI` it lost.
- Server errors reject with a `SolidisCommandError` whose `cause` is the server's `RespError`. Messages no longer list the command's arguments, and arguments the server quotes back are masked.
- New `{ buffer: true }` and `{ bigint: true }` command options, per-request timeouts, and option types that reject combinations the server refuses.
- The CommonJS build loads again, with its own type declarations, and the minimal bundle is smaller than in 0.4.0.

### Upgrading from 0.4.x

Steps 1 to 4 apply to most applications. Steps 5 to 8 apply only if you use the affected commands, options or classes.

#### 1. Remove deleted client options

Delete these options from your configuration. TypeScript reports them as unknown properties, and JavaScript ignores them.

| Removed option                                              | Reason                                                                                              |
| :---------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| `maxSocketWriteSizePerOnce`                                 | Each pipeline goes to the socket in one write, and Node merges queued writes into `writev` calls.   |
| `socketWriteTimeout`                                        | Writes count toward the command deadline. Use `commandTimeout` or a per-request `timeout` instead.  |
| `maxProcessReplyBytesPerChunk`, `maxProcessRepliesPerChunk` | The parser reads each socket chunk incrementally and resolves replies as soon as they are complete. |
| `parser.buffer.initial`, `parser.buffer.shiftThreshold`     | The parser no longer keeps a growing internal buffer.                                               |
| `maxEventListenersForSocket`                                | The client no longer adds socket listeners for each write.                                          |

#### 2. Replace removed commands

`clientReply()` and `sync()` are removed. `CLIENT REPLY OFF` and `CLIENT REPLY SKIP` make the server skip replies, and `SYNC` streams replication data, so the commands that followed received the wrong replies.

`send()` now rejects these commands with a `SolidisRequesterError` before anything is written, because the server skips or reshapes their replies:

- `CLIENT REPLY OFF`, `CLIENT REPLY SKIP`, `MONITOR`, `SYNC`, `PSYNC`, `REPLCONF ACK`, `REPLCONF GETACK`, `SCRIPT DEBUG YES` and `SCRIPT DEBUG SYNC`.
- `SUBSCRIBE`, `UNSUBSCRIBE` and their pattern and shard variants inside a transaction.
- A `commands` argument that is not an array, empty commands, entries that are not arrays, and commands with an argument that is neither a string nor a `Buffer`, such as `undefined` or a number.
- Commands other than `MULTI`, `EXEC`, `DISCARD` and `RESET` after a reconnect lost a `MULTI` sent with `send()`.

`CLIENT REPLY ON` and `SCRIPT DEBUG NO` are still accepted. Use a dedicated tool such as `redis-cli` for monitoring, replication and script debugging.

#### 3. Handle command errors through `cause`

A server error now always rejects the command with a `SolidisCommandError`. The message is the command name followed by the server's message, without the command's arguments, and `cause` is the `RespError` the server sent. When the server quotes an argument back with `'` or `` ` ``, as in `ERR Error in ACL SETUSER modifier '***'`, the argument is replaced with `***` in the message and in `cause`, even when the server cut it short. A value the server repeats without quotes, such as the coordinates in a `GEOADD` error or text a script passes to `redis.error_reply()`, stays as the server sent it. `RespError` has a new `code` property.

```typescript
import { RespError, SolidisCommandError } from '@vcms-io/solidis';

try {
  await client.get('session');
} catch (error) {
  if (error instanceof SolidisCommandError && error.cause instanceof RespError) {
    console.log(error.message);    // '[GET] WRONGTYPE Operation against a key holding the wrong kind of value'
    console.log(error.cause.code); // 'WRONGTYPE'
  }
}
```

- **Messages.** 0.4.x put every argument into the message, for example `[AUTH default <password>] Invalid reply: ...`. Messages are now `[COMMAND] <server message>`. A reply of an unexpected type is described by its shape, such as `[INCR] Unexpected reply: Buffer(12)`, never by its content. Match on `error.cause.code` instead of parsing messages.
- **`getOriginalError()`** is removed. Read the standard `error.cause` instead.
- **`RespError`** now extends `SolidisError`, so `instanceof SolidisError` also matches it.
- **Scripts.** `eval`, `evalRo`, `evalsha`, `evalshaRo`, `fcall`, `fcallRo` and `debug` used to resolve an error reply, such as `NOSCRIPT`, as a `RespError` value. They now reject, so the usual fallback works:

  ```typescript
  try {
    return await client.evalsha(sha, keys, parameters);
  } catch (error) {
    if (error instanceof SolidisCommandError && error.cause instanceof RespError && error.cause.code === 'NOSCRIPT') {
      return await client.eval(script, keys, parameters);
    }

    throw error;
  }
  ```

- **`send()`** is unchanged. Error replies stay in the returned arrays as `RespError` values unless `rejectOnPartialPipelineError` is enabled. With it enabled, a command whose reply is an error now rejects the call with a `SolidisCommandError` instead of the bare `RespError`. Errors nested inside a reply, such as those in an `EXEC` result or a `BF.MADD` array, no longer reject the call.

#### 4. Update code that reads changed results

| API                                  | 0.4.x                                                                          | Now                                                                             |
| :----------------------------------- | :----------------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| `pipeline(commands)`                 | Returned only the reply of the last command                                    | Returns one reply per command, in order                                         |
| `multi()` … `exec()`                 | Resolved `[null]` when `WATCH` aborted the transaction, and resolved EXECABORT | Resolves `null` when aborted; EXECABORT rejects with a `SolidisCommandError`    |
| `hrandfield(key, count, true)`       | `Record<string, string>`                                                       | `{ field, value }[]`, keeping the duplicates of a negative count                |
| `tsInfo(key)`                        | Raw fields as `Record<string, unknown>`                                        | `RespTimeSeriesInfo`, with `labels` as a record and `rules` as entries          |
| `tsMadd()`, `bfMadd()`, `bfInsert()` | Rejected the whole call when one item failed, after storing the others         | Resolve with one entry per item; a failed or skipped item is a `RespError`      |
| `cfInsert()`, `cfInsertnx()`         | Rejected the whole call with `Invalid reply` when the filter was full          | `null` for each item the full filter could not take                             |
| `xreadgroup()`                       | Rejected the batch when it contained a deleted entry                           | Returns deleted entries as `{ id, fields: null }` (`RespStreamGroupReadResult`) |
| `xinfoGroups()`, `xinfoStream()`     | Turned an unknown `entriesRead`, and the unknown `lag` of a group, into `0`    | `number \| null`                                                                |
| `xinfoStream()`, `xinfoConsumers()`  | Fields that older servers omit became `"undefined"` or `NaN`                   | `null`                                                                          |
| `xautoclaim()`, `xclaim()`           | Rejected after claiming when Redis 6.2 reported a deleted entry                | Skip the deleted entries                                                        |
| `tsMget()`                           | Rejected the call when a matching series had no samples                        | `timestamp` and `value` are `null` for a series without samples                 |
| `jsonObjkeys()`                      | Never `null`                                                                   | `null` for a missing key                                                        |
| `memoryStats()`                      | `db` was always empty, and fields the server does not report were `NaN`        | `db` is keyed by database index, and fields the server does not report are `0`  |
| `aclLog()`                           | `entryId` and the timestamps were `0` when the server did not send them        | `number \| null`                                                                |
| `aclGetuser()`                       | On Redis 6.2, `keys` and `channels` were patterns joined with commas           | Patterns with their `~` or `&` prefix, separated by spaces, as on Redis 7       |
| `info()`                             | Kept only the last of repeated fields, such as the `module` lines              | Repeated fields joined with `\n`                                                |
| `shutdown()`                         | Rejected with `Connection closed.` after the server shut down                  | Resolves `'OK'` when the server closes the connection                           |
| `bgsave()`, `bgrewriteaof()`         | Typed as `'OK'` and always rejected the actual reply                           | Resolve with the server's status, such as `'Background saving started'`         |
| `reset()`                            | Typed as `'OK'` and always rejected the actual reply                           | Resolves with `'RESET'`                                                         |
| `commandDocs()`                      | `subcommands` was a nested string record                                       | `subcommands` is a record of `RespCommandDoc`                                   |

```typescript
// pipeline() returns one raw reply per command, in order
const [setReply, getReply] = await client.pipeline([
  ['SET', 'greeting', 'hello'],
  ['GET', 'greeting'],
]);

// exec() resolves null when WATCH aborted the transaction
const transaction = client.multi();

transaction.incrby('balance', 5);

if ((await transaction.exec()) === null) {
  // retry the transaction
}

// HRANDFIELD WITHVALUES returns entries
const sample = await client.hrandfield('user:1', 2, true);
const record = Object.fromEntries(sample.map(({ field, value }) => [field, value]));

// TS.MADD, BF.MADD and BF.INSERT report each item
const added = await client.bfMadd('seen', ['a', 'b', 'c']);
const failed = added.filter((item) => item instanceof RespError);

// XREADGROUP returns entries deleted while pending with null fields
for (const { stream, entries } of (await client.xreadgroup('group', 'consumer', ['jobs'], ['0'])) ?? []) {
  for (const entry of entries) {
    if (entry.fields === null) {
      await client.xack(stream, 'group', [entry.id]);
    }
  }
}
```

**Transactions.** `multi()` exposes only commands. `reset`, `quit`, `send`, the scan iterators (`scan`, `hscan`, `sscan` and `zscan`), the event methods and non-function members such as `uri` are gone from its type and return `undefined` on it: `RESET` ends the transaction on the server, and a scan iterator needs each reply before it sends the next command. If the connection drops after `WATCH`, the next `exec()` sends `DISCARD` instead of `EXEC` and resolves `null`, as when a watched key changed, even if `WATCH` was sent again in between, so a transaction never commits without the guard it asked for and the usual retry loop covers it. An `EXEC` sent with `send()` gets `null` the same way. An empty `exec()` still sends `MULTI` and `EXEC`, and `discard()` or an `exec()` that rejects because a queued call failed sends `UNWATCH`, so a `WATCH` ends with its transaction. If the server refuses `MULTI`, as for an ACL user without `@transaction`, the queued commands have run on their own and `exec()` rejects with the `[MULTI]` error instead of `EXECABORT`.

```typescript
for (;;) {
  await client.watch('balance');

  const balance = Number(await client.get('balance'));
  const transaction = client.multi();

  transaction.set('balance', String(balance - 10));

  if ((await transaction.exec()) !== null) {
    break;
  }
}
```

**Integers beyond `Number.MAX_SAFE_INTEGER`.** `incr`, `incrby`, `decr`, `decrby` and `hincrby` rejected such results with an `Invalid reply` error, and `bitfield` and `bitfieldRo` returned them rounded. All of them now reject by default with `Unexpected reply: integer exceeds Number.MAX_SAFE_INTEGER` and the exact value as the error's `cause`. The server has already applied the command at that point, so do not retry it blindly. Pass `{ bigint: true }` to receive a `bigint`:

```typescript
const total = await client.incrby('counter', 10n, { bigint: true }); // bigint
```

#### 5. Update changed signatures

- `expireat(key, timestamp, { notExists: true })` becomes `expireat(key, timestamp, 'NX')`. The mode is `'NX'`, `'XX'`, `'GT'` or `'LT'`, as for `expire`, `pexpire` and `pexpireat`.
- `zintercard(keys, limit, options)` loses `options`. The server accepts neither `WEIGHTS` nor `AGGREGATE` for `ZINTERCARD`.
- `migrate()` with `keys` requires `''` as its key, as the server does.
- `scriptDebug()` accepts only `'NO'`; `send()` refuses `SCRIPT DEBUG YES` and `SCRIPT DEBUG SYNC`.
- `xpending()` takes `start`, `end` and `count` together (`CommandXpendingRange`) and no longer sends a count of 10 when `count` is missing. The summary form and the range form have their own return types.
- `zrange()`, `zrangebyscore()`, `zdiff()`, `zinter()`, `zunion()` and `zrandmember()` return `RespSortedSetMember[]` when scores are requested and `string[]` otherwise, instead of a union of both.

#### 6. Fix option combinations the types now reject

Option types follow the command grammar through the new `CommandExclusiveOptions` helper. Code that passes conflicting options no longer compiles. The server rejected most of these combinations anyway.

The option types of these commands, as well as `CommandGeoSearchOptions`, `CommandGeoSearchStoreOptions` and `RespCommandListFilter`, are now type aliases instead of interfaces. An interface can no longer extend them; use an intersection instead:

```typescript
// 0.4.x
interface AppSetOptions extends CommandSetOptions {}

// Now
type AppSetOptions = CommandSetOptions & { tenant?: string };
```

```typescript
// Compiled in 0.4.x, rejected now: two expirations
await client.set('key', 'value', { expireInSeconds: 60, expireInMilliseconds: 500 });
```

| Command                                            | Accepted combinations                                                                                                                                            |
| :------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set`                                              | One expiration (`expireIn…`, `expireAt…` or `keepOriginalTimeToLive`) and one condition (`setIfKeyNotExists`, `setIfKeyExists`, `setIfValue…` or `setIfDigest…`) |
| `getex`                                            | One expiration, or `persist`                                                                                                                                     |
| `delex`                                            | One condition                                                                                                                                                    |
| `geoadd`, `jsonSet`                                | `nx` or `xx`                                                                                                                                                     |
| `geosearch`, `geosearchstore`                      | One origin and one shape; `asc` or `desc`; `any` only with `count`                                                                                               |
| `georadius` and its variants                       | `store` or `storedist` only without `withCoord`, `withDist` and `withHash`                                                                                       |
| `zrange`, `zrangestore`                            | `byScore` or `byLex`; `limit` only with one of them; no `withScores` with `byLex`                                                                                |
| `clientTracking`                                   | `bcast`, `optin` or `optout`; `prefixes` only with `bcast: true`                                                                                                 |
| `clientUnblock`                                    | `timeout` or `error`                                                                                                                                             |
| `shutdown`                                         | `nosave`, `save` or `abort`, with `abort` alone                                                                                                                  |
| `failover`                                         | `abort` alone; `force` only with `to` and `timeout`                                                                                                              |
| `scriptFlush`                                      | `sync` or `async`                                                                                                                                                |
| `functionRestore`                                  | `replace`, `flush` or `append`                                                                                                                                   |
| `commandList`                                      | One filter: `module`, `aclcat` or `pattern`                                                                                                                      |
| `clientList`                                       | `type` or `identifiers`                                                                                                                                          |
| `bitpos`                                           | `mode` only with `end`                                                                                                                                           |
| `bfInsert`, `cfInsert`                             | `nocreate` only without `capacity` (and, on `bfInsert`, without `error`)                                                                                         |
| `migrate`                                          | `auth` or `auth2`                                                                                                                                                |
| `restore`                                          | `idletime` or `freq`                                                                                                                                             |
| `lcs`                                              | `len` or `idx`                                                                                                                                                   |
| `tsRange`, `tsRevrange`, `tsMrange`, `tsMrevrange` | `align` only with `aggregation`                                                                                                                                  |

Other option changes:

- **Time-series filters.** `filterByTs` is now one list of the exact timestamps to keep, and `filterByValue` a single `[min, max]` pair. 0.4.x typed both as lists of pairs and repeated the keyword for each pair.

  ```typescript
  // 0.4.x
  await client.tsRange('sensor', 0, Date.now(), { filterByTs: [[1000, 2000]], filterByValue: [[0, 100]] });

  // Now
  await client.tsRange('sensor', 0, Date.now(), { filterByTs: [1000, 2000], filterByValue: [0, 100] });
  ```

- `tsMget()` no longer takes `filterByValue`, which `TS.MGET` does not support.
- `failover({ to })` no longer takes `username` and `password`, which `FAILOVER` does not support.
- The geo search options no longer have `unit`, which was never sent.
- `set()` takes `returnOldValueAsBuffer` only with `returnOldValue: true`. On its own it sent no `GET`, and `set()` returned `'OK'`.

#### 7. Review connection settings and error listeners

- **URI precedence.** Explicit options now take precedence over the parts of `uri`. In 0.4.x, the host and port of the URI overrode `host` and `port`.

  ```typescript
  const client = new SolidisClient({ uri: 'redis://cache.internal:6380/2', port: 6379 });
  // 0.4.x: port 6380, and the database in the path was ignored
  // Now:   port 6379 and database 2
  ```

- **URI parsing.** The database in the path is applied, percent-encoded credentials are decoded, and bracketed IPv6 hosts work. A scheme other than `redis:` or `rediss:`, or an invalid database, makes the constructor throw a `SolidisClientError`.
- **Reconnect delay.** `connectionRetryDelay` was a fixed delay between attempts. It is now the first delay of an exponential backoff that doubles after each failed attempt, is capped by `maxConnectionRetryDelay` (default `2000` ms) and is jittered to 50–100%. With the defaults, the waits between the 20 retries add up to 17–33 seconds instead of 2 seconds. Lower `maxConnectionRetries` or `maxConnectionRetryDelay` if you need to fail faster.
  - `maxConnectionRetries` bounds each `connect()` and each lost connection. When the background reconnect gives up, the client emits an `error` saying `Connection failed after N retries.` and stops; the next command or `connect()` starts a new attempt. `Infinity` retries forever.
  - A connection that closes before it has stayed ready for `maxConnectionRetryDelay`, such as one whose handshake the server refuses, counts as a failed attempt. A server or proxy that accepts and drops connections, or a password changed on the server, is retried with growing delays until the retries are spent, instead of in an endless loop. Losing a connection that stayed ready longer starts a new count.
  - `reconnecting(attempt, delay)` is emitted before every attempt, including the first one after a drop. `attempt` counts the attempts since the connection was last stable, starting at 1.
- **Handshake.** The first `connect()` retries a handshake that a closing connection interrupted, within `maxConnectionRetries`. With `protocol: 'RESP3'`, only a server that does not know `HELLO` or answers `NOPROTO` falls back to RESP2; other `HELLO` errors, such as an invalid client name, fail with `Protocol negotiation failed`. A ready check denied with `NOPERM` counts as ready. A user chosen at runtime with `auth()` or `hello()`, and a protocol chosen with `hello()`, are restored after a reconnect, until `RESET`. A `CLIENT SETNAME` error other than `NOPERM` or an unknown command fails the handshake with `CLIENT SETNAME failed` and the server's reply as the cause, so a server that refuses the connection, such as one in protected mode or at `maxclients`, is reported at once instead of after every retry. A `WRONGPASS` or `NOAUTH` reply to any handshake step fails it with `Authentication failed`.
- **Listener errors.** A `connect`, `ready`, `reconnected`, `close`, `reconnecting`, `drain` or `end` listener that throws no longer breaks the session; the client emits an `error` (`A 'ready' listener threw`) and carries on. A throwing `debug` listener is reported with `process.emitWarning()`, and debug entries are delivered asynchronously.
- **Unhandled errors.** An `error` event without a listener used to reach only the debug log. It is now also passed to `process.emitWarning()`. Add a listener to handle errors yourself:

  ```typescript
  client.on('error', (error) => logger.warn(error));
  ```

#### 8. Update code that uses internal classes or command helpers

Skip this step unless you construct the internal classes yourself or write custom commands.

- **`SolidisConnection`:** `socket` and `cleanup()` are removed, and `reconnect()`, `write(buffer)` and `resetBackoff()` are added. `reset(error)` now takes the error to report with `close` and no longer reconnects by itself. `reconnect()` does nothing once its retries are spent, until the next `connect()`. `resetBackoff()` marks the connection ready; the backoff and the retries reset once the connection stays up for `maxConnectionRetryDelay`. The `closed` and `reconnected` events are replaced by `close(error)` and `reconnecting(attempt, delay)`, and `data` and `drain` are new.
- **`SolidisRequester`:** `setNegotiatedProtocol()`, `onReply()` and `recoveryFromFault()` are removed. The requester tracks `protocol`, `database` and `authentication` itself, `send()` takes request options, and its options require an `emit` function.
- **`SolidisParser`:** the constructor takes `{ parser }` options, and the asynchronous `queueParse(...buffers)` is replaced by the synchronous `parse(chunk)`.
- **`SolidisPubSub`:** the constructor takes the client's `emit`. The per-kind getters and clear methods, `getChannelsForUnsubscribeCommand()` and `dispatchPubSubEvent()` are replaced by `getSubscriptions()`, `clearSubscriptions()`, `clear()`, `dispatchPush()`, `dispatchMessage()` and `dispatchSubscriptionChange()`. `getSubscriptions()` returns the exact bytes of each channel as `Buffer[]`.
- **`SolidisDebugMemory`:** now an `EventEmitter` with a plain `write(entry)` instead of a `Writable` stream. `SolidisDebugTransform` is replaced by `formatDebugLog(entry)`.
- **Command helpers** in `@vcms-io/solidis/command/utils/*`:
  - `guard()` only requires a `send()` method, and `assertSender()` is new.
  - `executeCommand()` takes request options and rejects error replies.
  - `newCommandError(message, commandName, cause)` replaces the `prefix` parameter with a command name and an optional cause.
  - `tryReplyArray()` returns `unknown[]`, and `tryReplyToStringArray()` no longer has a `nullable` overload; use `tryReplyToNullableStringArray()`.
  - Removed: `InvalidReplyPrefix`, `tryReplyToStringRecordRecursively()` and `tryReplyToSortedSetMembersOrNull()`, and from `common/utils`, `checkReplyIsArray()` and `checkReplyIsMessageEvent()`.
  - Added: `tryReplyTuple()`, `tryReplyToInteger()`, `tryReplyToStringOrBuffer()` with its nullable, array and record variants, `executeIntegerCommand()`, `newUnexpectedReplyError()` and `describeReply()`.
- **Removed types:** `SolidisRecursiveStringRecord`, `RespClientReplyMode`, `RespAclLogKey`, `RespAclLogNumberKey`, `SolidisClientRecoveryStep`, `SolidisSubscribeMethod`, `SolidisSSubscribeMethod`, `SolidisPSubscribeMethod`, `SolidisTranslatedPubSubReplies`, `SolidisSocketWriteEventHandlers`, `SolidisRejectHandler`, `SolidisRequestResolveHandler` and `SolidisSubRequestResolveHandler`, and the internal parser and pipeline types `SolidisParsed`, `SolidisParsedBufferWithLength`, `SolidisRespType`, `SolidisRespPrimitiveType`, `SolidisRespLengthType`, `SolidisRespSimpleLineType`, `SolidisRequest`, `SolidisPipelineRequest`, `SolidisPipelineRequestChunk`, `SolidisPipelineRequestChunkContext` and `SolidisPipelineSubRequest`.

### Added

- `{ buffer: true }` returns the exact bytes as a `Buffer` from `get`, `getdel`, `getex`, `getrange`, `mget`, `hget`, `hmget`, `hgetall`, `hvals`, `lindex`, `lrange`, `lpop`, `rpop`, `lmove`, `blmove`, `rpoplpush`, `brpoplpush`, `blpop`, `brpop`, `lmpop` and `blmpop`. `mget` and `hmget` take it after their keys or fields, as in `mget('a', 'b', { buffer: true })`.
- `{ bigint: true }` returns a `bigint` from `incr`, `incrby`, `decr`, `decrby`, `hincrby`, `bitfield` and `bitfieldRo`. Increments and bitfield values accept `bigint`.
- `append`, `msetnx`, `lpush`, `rpush`, `lpushx`, `lset`, `linsert`, `lrem` and `lpos` accept `Buffer` values, and `publish` and `spublish` accept `Buffer` messages.
- `zcount`, `zrangebyscore`, `zrevrangebyscore` and `zremrangebyscore` accept `'-inf'`, `'+inf'` and exclusive bounds such as `'(1'` (`CommandScoreBound`).
- `send(commands, { timeout })` gives one request its own timeout. It applies while the request waits for the connection and again while it waits for the reply.
- `maxConnectionRetryDelay` caps the reconnect backoff.
- The `reconnecting(attempt, delay)` and `push(reply)` events, and the cause as the argument of `close(error)`. `push` carries RESP3 pushes that are not pub/sub messages, such as client tracking invalidations.
- `expire(key, seconds, mode)`, `lpop(key, count)` and `rpop(key, count)`.
- `hello()` without a protocol, and BITFIELD offsets such as `'#1'` that count in units of the field type (`CommandBitfieldOffset`).
- `RespError#code`, and `deletedIds` in the result of `xautoclaim()`.
- `role()` reads a Sentinel's `ROLE` reply as `{ role: 'sentinel', masterNames }`, `replicaof(host, port)` accepts `'ONE'` as the port for `REPLICAOF NO ONE`, and the time-series range commands accept `'-'` and `'+'` as timestamps and `'start'` and `'end'` for `align`.
- With RESP2 client tracking redirected to a subscribed client, invalidations on `__redis__:invalidate` are emitted as `push` events shaped like the RESP3 ones.
- `auth()` and `hello()` accept `Buffer` usernames and passwords, and a password chosen at runtime is sent again byte for byte after a reconnect.
- `tsIncrby()` and `tsDecrby()` take a `timestamp` option, `tsAdd()` and `tsMadd()` accept `'*'` for the server's clock, `tsDel()` accepts `'-'` and `'+'`, `bitop()` accepts `DIFF`, `DIFF1`, `ANDOR` and `ONE`, `scan()` takes module type names such as `ReJSON-RL` for `type`, and `latencyHistogram()` can be called without commands.
- Types: `CommandExclusiveOptions`, `CommandExactOptions`, `CommandBufferOptions`, `CommandIntegerOptions`, `CommandScoreBound`, `CommandBitposOptions`, `CommandBitfieldOffset`, `CommandXpendingRange`, `CommandTimeSeriesTimestamp`, `CommandTimeSeriesSampleTimestamp`, `RespString`, `RespInteger`, `SolidisSendOptions`, `RespHashEntry`, `RespRoleSentinel`, `RespTimeSeriesInfo`, `RespTimeSeriesRule`, `RespStreamDeletedEntry` and `RespStreamGroupReadResult`. `XclaimOptions` is exported from the package root, and `select` from `@vcms-io/solidis/command`.
- Utilities: `parseConnectionUri()`, `resolveClientOptions()`, `getCommandName()`, `toCommandError()`, `parseDouble()`, `formatDouble()` and `formatDebugLog()`, and for pub/sub event names `SolidisMessageEventNames`, `SolidisSubscribeEventNames`, `SolidisUnsubscribeEventNames`, `SolidisSubscriptionEventNames`, `getPubSubEventName()`, `isMessageEventName()`, `isSubscriptionEventName()` and `isUnsubscribeEventName()`. `SolidisTransactionBannedCommandNames` lists the command methods that a transaction leaves out; it also leaves out the scan iterators and the client's own methods, such as `send` and `quit`.
- The CommonJS entry points have their own declarations (`.d.cts`), so `require()` consumers on `node16` resolution type-check, and the declarations no longer need `esModuleInterop`.

### Changed

- Commands wait until the handshake (authentication, `HELLO`, `SELECT`, client name and ready check) has finished, bounded by `commandTimeout` or the request's `timeout`, and then run in the order they were sent.
- RESP3 connections authenticate with a single `HELLO 3 AUTH`, and `WRONGPASS` or `NOAUTH` fails the connection instead of continuing unauthenticated.
- After a reconnect, the client restores the database selected at runtime and each kind of subscription, and forgets a kind the server refuses.
- Blocking commands (`blpop`, `brpop`, `blmove`, `blmpop`, `brpoplpush`, `bzpopmin`, `bzpopmax`, `bzmpop`, `xread` and `xreadgroup` with `block`, `wait` and `waitaof`) run in a pipeline of their own. Their deadline is `commandTimeout` plus their own timeout, and they have none when they block forever.
- A pipeline that times out while later ones are still waiting keeps its place, and its late replies are discarded when they arrive. The connection is reset when a blocking pipeline times out, when every in-flight pipeline has timed out, or when a second pipeline in a row times out with nothing received since it was written, so a late reply can never reach a later command and a server that stops answering is dropped even under constant traffic.
- `quit()` rejects pending commands and pending `connect()` calls at once with a `SolidisClientError` whose message is `The client was quit.`, also when a `ready` listener calls it or the ready check is waiting, and `connect()` after `quit()` rejects the same way.
- Pipelines go to the socket as soon as they are sealed instead of waiting for `drain` after each write.
- Bulk replies of 64 KB or more are returned as views of the received data instead of copies.
- `zpopmin`, `zpopmax`, `bitfield`, `jsonNumincrby` and `jsonNummultby` never return `null`. `type()` returns the core types upper-cased and module type names, such as `ReJSON-RL`, as the server reports them.
- `jsonNumincrby` and `jsonNummultby` return the same text on RESP2 and RESP3, with exact integers beyond `Number.MAX_SAFE_INTEGER`; `bzpopmin` and `bzpopmax` format scores the same way on both protocols.
- Commands added with `extend()` keep their generic signatures, so options such as `{ buffer: true }` type their results. `extend()` types only the functions it adds.
- Every overload of a command can be called on a transaction, such as `multi().lpop(key)` and `multi().mget(a, b)`.
- `{ buffer: true }` and `{ bigint: true }` type a result regardless of the other options passed with them, and `getex` rejects misspelled options next to `buffer`.
- An argument-less `UNSUBSCRIBE`, `PUNSUBSCRIBE` or `SUNSUBSCRIBE` also ends the subscriptions that are still being confirmed.
- `SELECT`, `HELLO` and `AUTH` queued in a transaction take effect for session recovery only when `EXEC` runs them.
- A request timeout or `connectionTimeout` longer than 24.8 days, the limit of Node's timers, disables that deadline instead of expiring after 1 ms, longer reconnect delays and `readyCheckInterval` values are capped at that limit, and a negative blocking timeout no longer shortens a deadline.
- TLS connections send the host name for SNI unless it is an IP address. A `servername` in `tls` still takes precedence.
- The `error` emitted for a reply that arrives with no pending request carries the reply as its `cause`.
- `maxBulkStringLength` also limits simple string and error lines.
- A transaction from a client extended with `multi` also offers the client's own commands, such as `select` and `info`, and the commands of earlier `extend()` calls, and methods that a subclass of the client defines can be queued like commands.
- `bitcount()` and `bitpos()` fill a missing `start` with `0`, and `bitcount()` a missing `end` with `-1`.
- `functionFlush()` without an argument sends no mode, so the server's `lazyfree-lazy-user-flush` setting applies, as it does for `scriptFlush()`. Pass `false` for `SYNC`.
- `debugMaxEntries` and `maxEventListenersForClient` accept any number: a negative value or `NaN` keeps no debug entries and sets no listener limit, a fraction is rounded down, and `Infinity` keeps every entry.

### Removed

- `clientReply()` and `sync()`.
- The client options `maxEventListenersForSocket`, `maxProcessReplyBytesPerChunk`, `maxProcessRepliesPerChunk`, `maxSocketWriteSizePerOnce`, `socketWriteTimeout` and `parser.buffer`.
- `SolidisError#getOriginalError()`.

See [Upgrading from 0.4.x](#upgrading-from-04x) for replacements.

### Fixed

- The CommonJS build failed to load because of a circular import. Every entry point now loads through both `require()` and `import()`, and releases verify the packed tarball.
- A connection timeout could crash the process with an uncaught exception when the abandoned socket failed later. Timed-out sockets are destroyed, and events from replaced sockets are ignored.
- With RESP3 and `CLIENT TRACKING`, invalidation pushes were taken as command replies, so a `GET` could return the value of another key.
- On RESP2, while a `SUBSCRIBE` was pending, a reply whose first element was `"message"` was dispatched as a pub/sub message, and the following replies shifted.
- Commands issued during a reconnect ran before `SELECT` and wrote to database 0, and a database chosen with `select()` was lost after a reconnect.
- Blocking commands timed out after `commandTimeout` while the server kept them blocked, so an element popped afterwards was lost.
- Reconnects used a fixed interval and gave up after about two seconds without an event, so subscriber-only clients stopped receiving messages after short outages.
- `quit()` left pending commands to time out, or pending forever with `commandTimeout: 0`.
- `close` was declared but never emitted, so a lost connection showed only as a socket `error`.
- A handshake interrupted by a lost connection could continue on the next connection or report `ready` while disconnected or after `quit()`, and a `quit()` or `connect()` inside a `reconnecting` or `error` listener could leave a second socket open.
- A transaction lost its `WATCH` in a reconnect and committed anyway, also when `WATCH` was sent again after the reconnect, and a database selected inside a transaction was lost after a reconnect.
- A `MULTI` sent with `send()` was lost in a reconnect, so the commands after it ran one by one and `EXEC` failed. Those commands are refused now, and the `EXEC` returns `null`.
- `multi()` left `WATCH` armed after an empty `exec()`, a `discard()` or an `exec()` that rejected a failed call, so the next transaction was aborted. It also reported a refused `MULTI` as `EXECABORT` although the queued commands had run, and let `send`, `pipeline`, `quit` and the event methods run on the client.
- Commands sent before the client was ready could run after commands sent later, such as from a `ready` listener or after `await connect()`.
- A protocol chosen with `hello()` was lost in a reconnect, so a RESP3 client came back on RESP2, and refused every command if it was subscribed.
- A server that refused the connection, such as one in protected mode or at `maxclients`, was retried as if the connection had dropped, and its reason was not reported.
- A command that is not an array, such as `send([undefined])`, threw an uncaught `TypeError` and left the other commands of the same tick pending.
- Replies parsed before a protocol error in the same chunk were rejected with the parser error, although the server had executed their commands.
- An empty password was treated as none: `auth(user, '')` sent the username as the password, `hello()` skipped `AUTH`, and `authentication: { username, password: '' }` connected as `default`.
- `jsonArrpop(key, undefined, index)` ignored the index and popped the last element.
- `send()` with an argument that is not an array threw a `TypeError`, and before the client was ready it broke the handshake for every waiting request.
- A `HELLO` that names `SETNAME` before `AUTH` did not record the user for reconnects.
- Commands built from more than about 125,000 items, such as `bfInsert`, `cfInsert`, `hexpire`, `migrate` with `keys`, `pubsubNumsub`, `xread`, `xreadgroup` and the weights of `zinter`, threw a `RangeError` instead of being sent.
- `bitpos()` with `mode` but without `end` sent `0 -1`, so a search for bit 0 stopped treating the string as padded with zeros.
- A subscription to a channel name that is not valid UTF-8 was unsubscribed and restored with different bytes.
- `TYPE` rejected module type names such as `ReJSON-RL`, `INFO` dropped fields with empty values, `REPLICAOF` rejected the reply for an existing primary, and `ROLE` rejected Sentinel replies.
- `geosearch`, `georadius`, `sort`, `commandList`, `aclCat`, `pubsubChannels`, `pubsubShardchannels`, `functionList` and the scan iterators dropped empty-string options, so `scan({ match: '' })` returned every key, and `aclGenpass(0)` and a scan `count` of `0` were dropped as well. `sort()` rejected `{ store: undefined }`.
- A non-string argument, such as `undefined` from an optional property passed to `mset` or `hmset`, failed every request sent in the same tick. Only that request is rejected now.
- An invalid `port` rejected `connect()` with a plain `RangeError`. It rejects with a `SolidisConnectionError` now, without retrying.
- RESP3 doubles spelled `-nan`, as Redis 6.2 sends them, failed to parse, and long simple string replies split across many chunks took quadratic time.
- `bitop()` threw a plain `Error`, and an unparsable URI a `TypeError`; both are `SolidisError`s now. The `uri` getter brackets IPv6 hosts and encodes the username.
- The parser re-read partially received arrays from the start on every chunk, so large replies took quadratic time.
- URIs ignored the database, did not decode percent-encoded credentials and kept the brackets of IPv6 hosts.
- RESP2 infinite scores failed to parse in `zscore`, `zrange` with scores, `zincrby` and `zmpop`, and `bzmpop` failed after the server had already popped the members.
- `bgsave`, `bgrewriteaof` and `reset` rejected their successful replies, and `ping` rejected while subscribed on RESP2.
- `xreadgroup` rejected the whole batch when the pending history contained a deleted entry, and `XINFO` turned unknown values into `0`.
- Time-series commands placed `IGNORE` after `LABELS`, which created labels from its arguments, and `geosearchstore` did not send `storedist`.
- `__proto__` fields disappeared from returned records, RESP3 verbatim strings kept their `txt:` prefix, and `INFO` values containing `:` were cut short.
- `hrandfield` with a negative count lost duplicates, `jsonType` did not return `null` for a missing key with a JSONPath on RESP3, and `commandDocs` could not read the RESP3 set of history entries.
- Reply conversions for time-series `NaN` samples, JSON legacy paths, `CF.INFO`, `BITPOS`, `BITCOUNT`, `SORT` and `TYPE` were corrected.

### Security

- Error messages and stack traces no longer list command arguments. A failed `AUTH` used to put the password into the message, and a failed `SET` the value. Arguments the server quotes back in its own message, such as an ACL rule or the arguments of an unknown command, are replaced with `***`, also when the server joins several of them into one quoted span, as it does for an ACL selector.
- User data shaped like a pub/sub message can no longer be dispatched as a `message` event on RESP2.
- An integer reply longer than 20 characters or a big number longer than 4,096 digits is returned as an error reply instead of being converted, and a length line longer than 20 characters is a protocol error, so one reply can no longer stall the event loop for seconds.

### Performance

- The parser handles replies split across socket chunks in linear time.
- Serialization measures each argument once, and each reply allocates less.
- In alternating benchmark runs against 0.4.0, throughput is on par or better across the suite.
- Replies and timeouts for tens of thousands of pipelines in flight take linear time, and masking a long argument in an error message takes time linear in its length.
- The minimal client with `get` and `set` shrinks from 29,457 to 28,999 bytes, and the featured client from 99,356 to 95,724 bytes.

## [0.4.0] and earlier

See the [GitHub releases](https://github.com/vcms-io/solidis/releases).

[Unreleased]: https://github.com/vcms-io/solidis/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/vcms-io/solidis/releases/tag/v0.4.0

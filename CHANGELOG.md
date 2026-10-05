# Changelog

All notable changes to Solidis are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

This release rebuilds the core around one rule: every reply reaches the request that asked for it. Sessions survive reconnects, commands return one shape across RESP2, RESP3 and module versions, and reads can return `Buffer`s or `bigint`s.

> [!IMPORTANT]
> This release has breaking changes. Follow [Upgrading from 0.4.x](#upgrading-from-04x) before you update.

### Highlights

- Replies always reach their request, through RESP3 pushes, RESP2 data shaped like Pub/Sub messages, timed-out blocking commands and reconnects.
- A reconnect restores authentication, protocol, database and subscriptions before queued commands run, backs off with jitter, and never commits a transaction whose `WATCH` or `MULTI` it lost.
- Server errors reject with a `SolidisCommandError` whose `cause` is the server's `RespError`. Messages never list arguments and mask the ones the server quotes back.
- `{ buffer: true }` and `{ bigint: true }` options, per-request timeouts, and option types that reject what the server refuses.
- The CommonJS build loads again, with its own type declarations.

### Upgrading from 0.4.x

Steps 1–4 apply to most applications; steps 5–8 only if you use the affected commands, options or classes.

#### 1. Remove deleted client options

TypeScript flags them as unknown properties; JavaScript ignores them.

| Removed option                                              | Why                                                                            |
| :---------------------------------------------------------- | :----------------------------------------------------------------------------- |
| `maxSocketWriteSizePerOnce`                                 | Each pipeline is one write, and Node merges queued writes into `writev`.       |
| `socketWriteTimeout`                                        | Writes count toward the command deadline: use `commandTimeout` or a `timeout`. |
| `maxProcessReplyBytesPerChunk`, `maxProcessRepliesPerChunk` | The parser resolves each reply as soon as it is complete.                      |
| `parser.buffer.initial`, `parser.buffer.shiftThreshold`     | The parser no longer keeps a growing buffer.                                   |
| `maxEventListenersForSocket`                                | No socket listeners are added per write.                                       |
| `debugMaxEntries`                                           | Nothing could read the kept entries: listen to the `debug` event instead.      |

With `debug: true`, entries reach only the `debug` event and are no longer printed when `DEBUG` names solidis. Print them with `client.on('debug', (entry) => process.stdout.write(formatDebugLog(entry)))`.

#### 2. Replace removed commands

`clientReply()` and `sync()` are removed. `CLIENT REPLY OFF` and `SKIP` skip replies and `SYNC` streams replication data, so later commands received the wrong replies.

`send()` now rejects these with a `SolidisRequesterError` before writing anything:

- `CLIENT REPLY OFF`, `CLIENT REPLY SKIP`, `MONITOR`, `SYNC`, `PSYNC`, `REPLCONF ACK`, `REPLCONF GETACK`, `SCRIPT DEBUG YES`, `SCRIPT DEBUG SYNC`.
- `SUBSCRIBE`, `UNSUBSCRIBE` and their pattern and shard variants inside a transaction.
- A `commands` argument that is not an array, empty commands, entries that are not arrays, and arguments that are neither strings nor `Buffer`s.
- Anything but `MULTI`, `EXEC`, `DISCARD` and `RESET` after a reconnect lost a `MULTI` sent with `send()`.

`CLIENT REPLY ON` and `SCRIPT DEBUG NO` still work. Use `redis-cli` for monitoring, replication and script debugging.

#### 3. Handle command errors through `cause`

A server error always rejects with a `SolidisCommandError`. Its message is `[COMMAND] <server message>` without the arguments, and `cause` is the server's `RespError`, which has a new `code` property.

An argument the server quotes back with `'` or `` ` `` is masked from there to the last quote, also when the server cut it short: `ERR Error in ACL SETUSER modifier '***'`. Unquoted echoes stay, such as `GEOADD` coordinates, `redis.error_reply()` text or a `FUNCTION LOAD` library name, and so does text the server quotes from inside an argument, such as a Lua token in a script error. Messages over 4,096 characters are cut, and a quoted argument the cut leaves open is masked to the end.

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

- **Messages.** 0.4.x put every argument in the message: `[AUTH default <password>] Invalid reply: ...`. An unexpected reply is now described by its shape, such as `[INCR] Unexpected reply: Buffer(12)`. Match on `error.cause.code`.
- **`getOriginalError()`** is removed. Read `error.cause`.
- **`RespError`** extends `SolidisError`.
- **Error replies.** `eval`, `evalRo`, `evalsha`, `evalshaRo`, `fcall`, `fcallRo`, `debug` and `jsonResp` reject an error reply such as `NOSCRIPT` instead of resolving it, so the usual fallback works:

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

- **`send()`** still returns error replies as `RespError` values. With `rejectOnPartialPipelineError`, an error reply rejects with a `SolidisCommandError` instead of the bare `RespError`, and errors nested in a reply, as in an `EXEC` result or a `BF.MADD` array, no longer reject.

#### 4. Update code that reads changed results

| API                                  | 0.4.x                                                                             | Now                                                              |
| :----------------------------------- | :-------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| `pipeline(commands)`                 | The reply of the last command only                                                | One reply per command, in order                                  |
| `multi()` … `exec()`                 | `[null]` when `WATCH` aborted; resolved EXECABORT                                 | `null` when aborted; EXECABORT rejects                           |
| empty `exec()`                       | `[]` without contacting the server                                                | Sends `MULTI` and `EXEC`; `null` when a watched key changed      |
| `hrandfield(key, count, true)`       | `Record<string, string>`                                                          | `{ field, value }[]`, keeping the duplicates of a negative count |
| `tsInfo(key)`                        | Raw `Record<string, unknown>`                                                     | `RespTimeSeriesInfo`: `labels` as a record, `rules` as entries   |
| `tsMadd()`, `bfMadd()`, `bfInsert()` | Rejected the call when one item failed, after storing the others                  | One entry per item; a failed or skipped item is a `RespError`    |
| `cfInsert()`, `cfInsertnx()`         | Rejected with `Invalid reply` when the filter was full                            | `null` for each item a full filter could not take                |
| `xreadgroup()`                       | Rejected a batch holding a deleted entry                                          | Deleted entries as `{ id, fields: null }`                        |
| `xinfoGroups()`, `xinfoStream()`     | An unknown `entriesRead`, and in `xinfoGroups()` `lag`, became `0`                | `number \| null`                                                 |
| `xinfoStream()`, `xinfoConsumers()`  | Fields older servers omit, also in `xinfoGroups()`, became `"undefined"` or `NaN` | `null`                                                           |
| `xinfoStream(key, true, count)`      | Declared `firstEntry` and `lastEntry`, always `null` with FULL                    | `RespStreamInfoFull` drops them; `count` needs `full: true`      |
| `xautoclaim()`, `xclaim()`           | Rejected after claiming a deleted entry on Redis 6.2                              | Skip deleted entries                                             |
| `tsMget()`                           | Rejected a series without samples                                                 | `timestamp` and `value` are `null` for it                        |
| `jsonObjkeys()`                      | Rejected a missing key with `Unexpected reply: null`                              | `null` with a legacy path; the server's error with a JSONPath    |
| `memoryStats()`                      | `db` always empty; unreported fields were `NaN`                                   | `db` keyed by database index; unreported fields are `0`          |
| `aclLog()`                           | Missing `entryId` and timestamps were `0`                                         | `number \| null`                                                 |
| `aclGetuser()`                       | On Redis 6.2, `keys` and `channels` joined patterns with commas                   | Patterns with their `~` or `&` prefix, space-separated           |
| `info()`                             | Kept the last of repeated fields, such as `module`                                | Repeated fields joined with `\n`                                 |
| `shutdown()`                         | Rejected with `Connection closed.`                                                | `'OK'` when the connection closes after it was sent              |
| `bgsave()`, `bgrewriteaof()`         | Typed `'OK'`; rejected the actual reply                                           | The server's status, such as `'Background saving started'`       |
| `reset()`                            | Typed `'OK'`; rejected the actual reply                                           | `'RESET'`                                                        |
| `commandDocs()`                      | Rejected every command with subcommands                                           | `subcommands` is a record of `RespCommandDoc`                    |

```typescript
// pipeline() returns one raw reply per command, in order, and an array of them
// for a command the server answers more than once, such as SUBSCRIBE with several channels
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

**Transactions**

- `multi()` exposes only commands. Client methods such as `send`, `quit` and the event methods, non-functions such as `uri`, and the commands in `SolidisTransactionBannedCommandNames` are gone from its type and return `undefined`: `multi`, `pipeline`, `watch`, `unwatch`, the subscribe and unsubscribe methods, `auth`, `hello`, `reset` and the scan iterators. Call `watch()` on the client before `multi()`.
- When a dropped connection loses a `WATCH`, the next `exec()` sends `DISCARD` and resolves `null`, as for a changed key, even if `WATCH` was sent again. An `EXEC` sent with `send()` gets `null` the same way, so the usual retry loop covers it.
- `exec()` still resolves the raw replies. An empty `exec()` sends `MULTI` and `EXEC` too, so it ends a `WATCH`.
- `discard()`, and an `exec()` that rejects because a call failed or `send()` refuses a queued command, send `UNWATCH`.
- If the server refuses `MULTI`, as for a user without `@transaction`, the queued commands have run alone and `exec()` rejects with `[MULTI]` instead of `EXECABORT`.

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

**Integers beyond `Number.MAX_SAFE_INTEGER`.** `incr`, `incrby`, `decr`, `decrby` and `hincrby` rejected them with `Invalid reply`, and `bitfield` and `bitfieldRo` rounded them. All now reject with `Unexpected reply: integer exceeds Number.MAX_SAFE_INTEGER` and the exact value as `cause`. The command has already run, so do not retry it blindly. Pass `{ bigint: true }` for a `bigint`:

```typescript
const total = await client.incrby('counter', 10n, { bigint: true }); // bigint
```

#### 5. Update changed signatures

- `expireat(key, timestamp, { notExists: true })` becomes `expireat(key, timestamp, 'NX')`. Modes are `'NX'`, `'XX'`, `'GT'`, `'LT'`, `'XX GT'` and `'XX LT'` (`CommandKeyExpireMode`), as for `expire`, `pexpire` and `pexpireat`.
- `zintercard(keys, limit, options)` loses `options`: the server takes neither `WEIGHTS` nor `AGGREGATE` there.
- `migrate()` with `keys` requires `''` as its key, as the server does.
- `scriptDebug()` takes only `'NO'`; `send()` refuses `SCRIPT DEBUG YES` and `SYNC`.
- `auth()` takes a password after an optional username: `auth(password)` or `auth(username, password)`. A call without a password no longer compiles. As in `hello()`, an empty username (`''` or an empty `Buffer`) means the default user.
- `hello()` takes credentials or a client name only after a protocol, and a username only with a password (`CommandHelloParameters`). `HELLO` ignored them otherwise and resolved without authenticating.
- `xpending()` takes `start`, `end` and `count` together (`CommandXpendingRange`) and no longer sends a count of 10 when `count` is missing. The summary and range forms have their own return types.
- `zrange()`, `zrangebyscore()`, `zdiff()`, `zinter()`, `zunion()` and `zrandmember()` return `RespSortedSetMember[]` with scores and `string[]` without, instead of a union.

#### 6. Fix option combinations the types now reject

Option types follow the command grammar through the new `CommandExclusiveOptions` helper, so conflicting options no longer compile. The server rejected most of them anyway.

These option types, plus `CommandGeoSearchOptions`, `CommandGeoSearchStoreOptions` and `RespCommandListFilter`, are type aliases now. Use an intersection instead of `extends`:

```typescript
// 0.4.x
interface AppSetOptions extends CommandSetOptions {}

// Now
type AppSetOptions = CommandSetOptions & { tenant?: string };

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
| `bfReserve`                                        | `expansion` or `nonScaling`                                                                                                                                      |
| `jsonDebug`                                        | `'HELP'` alone, or `'MEMORY'` with a key                                                                                                                         |
| `restore`                                          | `idletime` or `freq`                                                                                                                                             |
| `lcs`                                              | `len` or `idx`                                                                                                                                                   |
| `tsRange`, `tsRevrange`, `tsMrange`, `tsMrevrange` | `align` only with `aggregation`; `'start'` or `'-'` only after a numeric start, `'end'` or `'+'` only before a numeric end                                       |

Other option changes:

- **Time-series filters.** `filterByTs` is one list of exact timestamps to keep, and `filterByValue` one `[min, max]` pair. 0.4.x typed both as lists of pairs and repeated the keyword per pair.

  ```typescript
  // 0.4.x
  await client.tsRange('sensor', 0, Date.now(), { filterByTs: [[1000, 2000]], filterByValue: [[0, 100]] });

  // Now
  await client.tsRange('sensor', 0, Date.now(), { filterByTs: [1000, 2000], filterByValue: [0, 100] });
  ```

- `tsMget()` drops `filterByValue`, and `failover({ to })` drops `username` and `password`: the commands do not support them.
- The geo search options drop `unit`, which was never sent.
- `set()` takes `returnOldValueAsBuffer` only with `returnOldValue: true`. On its own it sent no `GET`, and `set()` returned `'OK'`.

#### 7. Review connection settings and error listeners

- **URI precedence.** Explicit options now win over the parts of `uri`; in 0.4.x the URI's host and port won.

  ```typescript
  const client = new SolidisClient({ uri: 'redis://cache.internal:6380/2', port: 6379 });
  // 0.4.x: port 6380, and the database in the path was ignored
  // Now:   port 6379 and database 2
  ```

- **URI parsing.** The path's database is applied, percent-encoded credentials are decoded, and bracketed IPv6 hosts work. A scheme other than `redis:` or `rediss:`, or an invalid database, throws a `SolidisClientError`. `redis://name@host` now means user `name` with an empty password; 0.4.x sent `name` as the password, as `redis-cli` reads it. Write `redis://:secret@host` for a password alone.
- **Reconnect delay.** `connectionRetryDelay` now starts an exponential backoff that doubles per failed attempt, is capped by `maxConnectionRetryDelay` (`2000` ms) and is jittered to 50–100%. With the defaults, the 20 retries wait 17–33 seconds instead of 2. Lower `maxConnectionRetries` or `maxConnectionRetryDelay` to fail faster.
  - `maxConnectionRetries` bounds each `connect()` and each lost connection. When the background reconnect gives up, the client emits an `error` (`Connection failed after N retries.`) and stops until the next command or `connect()`. `Infinity` retries forever.
  - A connection that closes before it stays ready for `maxConnectionRetryDelay` counts as a failed attempt. Servers or proxies that drop connections, or refuse a changed password, are retried with growing delays until the retries run out, not in an endless loop.
  - `reconnecting(attempt, delay)` fires before every attempt, including the first after a drop. `attempt` counts from 1 since the connection was last stable.
- **Handshake.**
  - The first `connect()` retries a handshake that a closing connection interrupted, within `maxConnectionRetries`.
  - With `protocol: 'RESP3'`, only a server that lacks `HELLO` or answers `NOPROTO` falls back to RESP2. Other `HELLO` errors, such as an invalid client name, fail with `Protocol negotiation failed`.
  - A ready check denied with `NOPERM` counts as ready, and the check stops waiting when its connection closes.
  - A user chosen at runtime with `auth()` or `hello()`, and a protocol chosen with `hello()`, are restored after a reconnect until `RESET`, after which a reconnect uses the configured user, protocol and database. `SELECT`, `HELLO` and `AUTH` queued in a transaction count once `EXEC` runs them, and a `MULTI` or `WATCH` the server refuses does not count as lost.
  - A `CLIENT SETNAME` error other than `NOPERM` or an unknown command fails with `CLIENT SETNAME failed`.
  - An error sent before any request, as from a server in protected mode or at `maxclients`, rejects the waiting requests at once with a `SolidisConnectionError` that carries the server's reply. When the handshake sends nothing, `connect()` resolves first, and the refusal reaches the waiting commands, a command already sent, or the `error` listeners.
  - `WRONGPASS` or `NOAUTH` on any step, including restoring the database and subscriptions, and any other `AUTH` error fail with `Authentication failed`. Another `SELECT` error fails with `SELECT failed`.
- **Listener errors.** A throwing `connect`, `ready`, `reconnected`, `close`, `reconnecting`, `drain` or `end` listener no longer breaks the session; the client emits an `error` such as `A 'ready' listener threw`. A throwing `debug` listener goes to `process.emitWarning()`, and debug entries are delivered asynchronously.
- **Unhandled errors.** An `error` event without a listener now also goes to `process.emitWarning()`, even after `removeAllListeners()`. Add a listener to handle errors yourself:

  ```typescript
  client.on('error', (error) => logger.warn(error));
  ```

#### 8. Update code that uses internal classes or command helpers

Skip this step unless you build the internal classes yourself or write custom commands.

- **`SolidisConnection`:**
  - `socket` and `cleanup()` are removed; `reconnect()`, `write(buffer)` and `resetBackoff()` are added.
  - `reset(error)` takes the error to report with `close` and no longer reconnects. `reconnect()` does nothing once its retries are spent, until the next `connect()`.
  - `resetBackoff()` marks the connection ready, and the backoff and retries reset once it stays up for `maxConnectionRetryDelay`.
  - `close(error)` and `reconnecting(attempt, delay)` replace `closed` and `reconnected`; `data` and `drain` are new.
- **`SolidisRequester`:** `setNegotiatedProtocol()`, `onReply()` and `recoveryFromFault()` are removed. It tracks `protocol`, `database` and `authentication` itself, `send()` takes request options, and its options require an `emit` function.
- **`SolidisParser`:** takes `{ parser }` options. The synchronous `parse(chunk)` replaces the asynchronous `queueParse(...buffers)`.
- **`SolidisPubSub`:** takes the client's `emit`. `getSubscriptions()`, `clearSubscriptions()`, `clear()`, `dispatchPush()`, `dispatchMessage()` and `dispatchSubscriptionChange()` replace the per-kind getters and clear methods, `getChannelsForUnsubscribeCommand()` and `dispatchPubSubEvent()`. `getSubscriptions()` returns the exact bytes of each channel as `Buffer[]`.
- **Debug:**
  - Removed: `SolidisDebugMemory`, `SolidisDebugTransform`, `SolidisDebugEvents`, `SolidisDebugMemoryEventHandlers`, `generateDebugHandle()`, `sanitizeCommandsBufferForDebug()` and `SolidisCredentialCommandNameSet`.
  - `SolidisConnection` and `SolidisRequester` take `debugHandle` (`SolidisDebugHandle`) instead of `debugMemory`.
  - Every `SolidisDebugLog` has a `timestamp`, and `formatDebugLog(entry)` formats an entry for printing.
  - A pipeline entry names its commands and size instead of the serialized bytes, so no entry contains an argument.
- **Command helpers** in `@vcms-io/solidis/command/utils/*`:
  - `guard()` only requires `send()` and always returns `true`, since a call on a transaction queues what it sends; `assertSender()` is new.
  - `executeCommand(client, command, replyTo, options, sendOptions)` passes `replyTo` a copy of `options` taken at call time, takes request options last and rejects error replies.
  - `newCommandError(message, commandName, cause)` replaces the `prefix` parameter with a command name and an optional cause.
  - `tryReplyArray()` returns `unknown[]`, and `tryReplyToStringArray()` drops its `nullable` overload; use `tryReplyToNullableStringArray()`.
  - Removed: `InvalidReplyPrefix`, `tryReplyToStringRecordRecursively()` and `tryReplyToSortedSetMembersOrNull()`, and from `common/utils`, `checkReplyIsArray()` and `checkReplyIsMessageEvent()`.
  - Added reply readers: `tryReplyTuple()`, `tryReplyToInteger()`, `tryReplyToStringOrBuffer()` with its nullable, array and record variants, `tryReplyToCuckooFilterInsertResults()`, `tryReplyToJsonNumberText()`, `tryReplyToJsonNumbers()`, `tryReplyToNumberOrErrorArray()`, `tryReplyToStreamEntryOrDeleted()` and `tryReplyToStreamGroupReadResultsOrNull()`.
  - Added executors: `executeIntegerCommand()`, `buildKeyIntegerExecutor()`, `buildKeyPopExecutor()` and `buildKeyStringOrBufferExecutor()`.
  - Added helpers: `newUnexpectedReplyError()`, `describeReply()`, `setRecordEntry()` and `appendRecordEntries()`.
  - `tryReplyToKeyValuePairOrNull()` and `tryReplyToKeyStringElementsOrNull()` take an optional `options` argument.
- **Removed types:**
  - `SolidisRecursiveStringRecord`, `RespClientReplyMode`, `RespAclLogKey`, `RespAclLogNumberKey` and `SolidisClientRecoveryStep`.
  - Pub/Sub: `SolidisSubscribeMethod`, `SolidisSSubscribeMethod`, `SolidisPSubscribeMethod` and `SolidisTranslatedPubSubReplies`.
  - Handlers: `SolidisSocketWriteEventHandlers`, `SolidisRejectHandler`, `SolidisRequestResolveHandler` and `SolidisSubRequestResolveHandler`.
  - Internal parser and pipeline types: `SolidisParsed`, `SolidisParsedBufferWithLength`, `SolidisRespType`, `SolidisRespPrimitiveType`, `SolidisRespLengthType`, `SolidisRespSimpleLineType`, `SolidisRequest`, `SolidisPipelineRequest`, `SolidisPipelineRequestChunk`, `SolidisPipelineRequestChunkContext` and `SolidisPipelineSubRequest`.

### Added

- `{ buffer: true }` returns the exact bytes as a `Buffer` from `get`, `getdel`, `getex`, `getrange`, `mget`, `hget`, `hmget`, `hgetall`, `hvals`, `lindex`, `lrange`, `lpop`, `rpop`, `lmove`, `blmove`, `rpoplpush`, `brpoplpush`, `blpop`, `brpop`, `lmpop` and `blmpop`.
  - `mget` and `hmget` take it after their keys or fields, as in `mget('a', 'b', { buffer: true })`, and read a trailing `undefined` as missing options.
  - Result types follow `{ buffer: true }` and `{ bigint: true }` whatever else is passed.
- `{ bigint: true }` returns a `bigint` from `incr`, `incrby`, `decr`, `decrby`, `hincrby`, `bitfield` and `bitfieldRo`. Increments and bitfield values accept `bigint`.
- `Buffer` values for `append`, `msetnx`, `lpush`, `rpush`, `lpushx`, `lset`, `linsert`, `lrem` and `lpos`, and `Buffer` messages for `publish` and `spublish`.
- `'-inf'`, `'+inf'` and exclusive bounds such as `'(1'` for `zcount`, `zrangebyscore`, `zrevrangebyscore` and `zremrangebyscore` (`CommandScoreBound`).
- `send(commands, { timeout })` gives one request its own timeout, applied while it waits for the connection and again while it waits for the reply. `send(commands, { blockingTimeout })` handles a raw blocking command like `blpop()`.
- `maxConnectionRetryDelay` caps the reconnect backoff.
- The `reconnecting(attempt, delay)` and `push(reply)` events, and the cause as the argument of `close(error)`. `push` carries RESP3 pushes that are not Pub/Sub messages, such as client tracking invalidations.
- `expire(key, seconds, mode)`, `lpop(key, count)` and `rpop(key, count)`, and `hset(key, fields)` for several fields.
- `hello()` without a protocol, and BITFIELD offsets such as `'#1'` that count in units of the field type (`CommandBitfieldOffset`).
- `RespError#code`, and `deletedIds` in the result of `xautoclaim()`.
- `on()` and `once()` accept `errorMonitor`.
- `role()` reads a Sentinel's reply as `{ role: 'sentinel', masterNames }`, `replicaof('NO', 'ONE')` sends `REPLICAOF NO ONE`, and the time-series range commands take `'-'` and `'+'` as timestamps and `'start'` and `'end'` for `align`.
- With RESP2 client tracking redirected to a subscribed client, `__redis__:invalidate` messages are emitted as `push` events shaped like the RESP3 ones.
- `auth()` and `hello()` accept `Buffer` usernames and passwords, and a password chosen at runtime is sent again byte for byte after a reconnect.
- `tsIncrby()` and `tsDecrby()` take a `timestamp` option, `tsAdd()` and `tsMadd()` accept `'*'`, `tsDel()` accepts `'-'` and `'+'`, `bitop()` accepts `DIFF`, `DIFF1`, `ANDOR` and `ONE`, `scan()` takes module type names such as `ReJSON-RL` for `type`, and `latencyHistogram()` works without commands.
- Types:
  - Options: `CommandExclusiveOptions`, `CommandExactOptions`, `CommandBufferOptions`, `CommandIntegerOptions`, `CommandBitposOptions`, `SolidisSendOptions` and `SolidisParserOptions`.
  - Arguments: `CommandScoreBound`, `CommandBitfieldOffset`, `CommandHelloParameters`, `CommandXpendingRange`, `CommandTimeSeriesTimestamp`, `CommandTimeSeriesSampleTimestamp`, `CommandTimeSeriesRangeParameters`, `CommandKeyExpireMode` and `CommandReplicaofTarget`.
  - Replies: `RespString`, `RespInteger`, `RespHashEntry`, `RespRoleSentinel`, `RespTimeSeriesInfo`, `RespTimeSeriesRule`, `RespStreamDeletedEntry` and `RespStreamGroupReadResult`.
  - Events: `SolidisClientEmit`, `SolidisMessageEventName`, `SolidisSubscriptionEventName` and `SolidisUnsubscribeEventName`.
  - `XclaimOptions` is exported from the package root, and `select` from `@vcms-io/solidis/command`.
- Utilities:
  - `parseConnectionUri()`, `resolveClientOptions()`, `getCommandName()`, `toCommandError()`, `parseDouble()`, `formatDouble()` and `formatDebugLog()`.
  - Pub/Sub event names: `SolidisMessageEventNames`, `SolidisSubscribeEventNames`, `SolidisUnsubscribeEventNames`, `SolidisSubscriptionEventNames`, `getPubSubEventName()`, `isMessageEventName()`, `isSubscriptionEventName()` and `isUnsubscribeEventName()`.
  - `SolidisTransactionBannedCommandNames` lists the command methods a transaction leaves out, the scan iterators included. A transaction also leaves out client methods such as `send` and `quit`.
- The CommonJS entry points have their own declarations (`.d.cts`), so `require()` consumers on `node16` resolution type-check without `esModuleInterop`.

### Changed

- Commands wait for the handshake (authentication, `HELLO`, `SELECT`, client name and ready check), bounded by `commandTimeout` or the request's `timeout`, and then run in the order they were sent.
- RESP3 connections authenticate with one `HELLO 3 AUTH`, and `WRONGPASS` or `NOAUTH` fails the connection instead of continuing unauthenticated.
- After a reconnect, the client restores the database selected at runtime and every subscription, one command per channel. When the server refuses any channel of a kind, the client unsubscribes from that whole kind and emits an `error`.
- Blocking commands (`blpop`, `brpop`, `blmove`, `blmpop`, `brpoplpush`, `bzpopmin`, `bzpopmax`, `bzmpop`, `xread` and `xreadgroup` with `block`, `wait` and `waitaof`) run in a pipeline of their own. Their deadline is `commandTimeout` plus their own timeout, and none when they block forever.
- The connection also resets when a blocking pipeline times out, or, unless `commandTimeout` is `0`, when a second pipeline in a row times out with nothing received since it was written and the oldest pipeline has waited at least `commandTimeout`. A late reply never reaches a later command, and a silent server is dropped even under constant traffic with shorter per-request timeouts.
- `quit()` rejects pending commands and `connect()` calls at once with a `SolidisClientError` (`The client was quit.`), also from a `ready` listener or during the ready check. Later calls reject the same way.
- Pipelines go to the socket as soon as they are sealed instead of waiting for `drain` after each write.
- A pipeline that cannot be serialized, such as one larger than the largest `Buffer`, rejects its requests with a `SolidisRequesterError` and resets the connection, which rejects the requests in flight too.
- When the connection closes, requests in flight reject with the error that closed it, and requests not yet written with a `SolidisRequesterError` (`Socket is not connected.`) whose `cause` is that error.
- Bulk replies are views of the received data instead of copies. A held `Buffer` reply keeps the chunk it arrived in, up to 64 KB, in memory, so copy it with `Buffer.from()` to keep it long.
- `zpopmin`, `zpopmax`, `bitfield`, `jsonNumincrby` and `jsonNummultby` never return `null`. `type()` returns core types upper-cased and module type names, such as `ReJSON-RL`, as the server reports them.
- `jsonNumincrby` and `jsonNummultby` return the same text on both protocols, exact beyond `Number.MAX_SAFE_INTEGER`; for a legacy path, the last number they updated. Both protocols reject with an `ERR` reply when a legacy path matches no number. `bzpopmin` and `bzpopmax` format scores the same way on both protocols.
- Commands added with `extend()` keep their generic signatures, so options such as `{ buffer: true }` type their results. `extend()` types only the functions it adds, and `this` inside them as the extended client with the commands of earlier `extend()` calls.
- Every overload of a command can be called on a transaction, such as `multi().sort(key)` and `multi().jsonArrpop(key)`.
- An argument-less `UNSUBSCRIBE`, `PUNSUBSCRIBE` or `SUNSUBSCRIBE` also ends subscriptions still being confirmed.
- A request timeout or `connectionTimeout` longer than 24.8 days, the limit of Node's timers, disables that deadline instead of expiring after 1 ms. Longer reconnect delays and `readyCheckInterval` values are capped at that limit.
- TLS connections send the host name for SNI unless it is an IP address; a `servername` in `tls` still wins.
- The `error` for a reply that arrives with no pending request carries the reply as its `cause`.
- `maxBulkStringLength` also limits simple string and error lines.
- A transaction from a client extended with `multi` also offers the client's own commands, such as `select` and `info`, the commands of earlier `extend()` calls, and methods a subclass of the client defines.
- `latencyHistory()`, `latencyGraph()` and `latencyReset()` accept any event name, including `module-acquire-GIL` and every `event` that `latencyLatest()` returns.
- `bitcount()` and `bitpos()` fill a missing `start` with `0`, and `bitcount()` a missing `end` with `-1`.
- `functionFlush()` without an argument sends no mode, so the server's `lazyfree-lazy-user-flush` applies, as for `scriptFlush()`. Pass `false` for `SYNC`.
- The published files keep class and function names, so errors print as `SolidisCommandError: ...` and stack traces name the methods.
- A throwing `error` listener no longer interrupts the client, which still resets the connection and routes the remaining replies. The exception is thrown again asynchronously, so it reaches `uncaughtException` as before.
- Empty lists:
  - `clientList({ identifiers: [] })` and the time-series range commands with `filterByTs: []` send the empty list, which the server refuses, instead of acting on every client or sample.
  - `migrate()` with `keys: []` sends an empty `KEYS` list, which migrates nothing, instead of migrating the `key` argument.
  - `zinter()`, `zinterstore()`, `zunion()` and `zunionstore()` with `weights: []` send an empty `WEIGHTS` list, which the server refuses, instead of using the default weights.
  - `latencyReset([])`, `commandDocs([])` and `clientTracking()` with `prefixes: []` reject instead of acting on every event, command or key.
- `cfMexists()` is typed as returning `boolean[]`, and `set()` as returning `'OK'` or `null`, the old string, or with `returnOldValueAsBuffer` the old `Buffer`.
- `hmset()`, `mset()`, `msetnx()` and `xadd()` reject fields that are not an object of names and values, such as separate field and value arguments or the flat array ioredis takes, instead of writing every character or array index as a field. `hset()` rejects field and value pairs after the first, which 0.4.x dropped, and `lcs()` with `idx` rejects a malformed match instead of dropping it.
- `maxEventListenersForClient` accepts any number; a negative value or `NaN` sets no listener limit.

### Removed

- `clientReply()` and `sync()`.
- The client options `debugMaxEntries`, `maxEventListenersForSocket`, `maxProcessReplyBytesPerChunk`, `maxProcessRepliesPerChunk`, `maxSocketWriteSizePerOnce`, `socketWriteTimeout` and `parser.buffer`, and printing debug entries when `DEBUG` names solidis.
- `SolidisDebugMemory`, `SolidisDebugTransform`, `SolidisDebugEvents`, `SolidisDebugMemoryEventHandlers`, `generateDebugHandle()`, `sanitizeCommandsBufferForDebug()` and `SolidisCredentialCommandNameSet`.
- `SolidisError#getOriginalError()`.

See [Upgrading from 0.4.x](#upgrading-from-04x) for replacements.

### Fixed

- `set()` and `delex()` sent any digest. With `returnOldValue`, a digest that is not 16 characters made Redis 8.4 and later answer one `SET` twice, and every later reply reached the wrong request. A digest that is not 16 hexadecimal digits now rejects before anything is sent.
- `zrange()` and the other commands that take `withScores` read it when the reply arrived, and the scan iterators read their options again for every page, so changing an options object after the call changed the result. Options are read when the command is called.
- `auth('')` sent `AUTH` without the empty password.
- The CommonJS build failed to load because of a circular import. Every entry point now loads through both `require()` and `import()`, and releases verify the packed tarball.
- A connection timeout could crash the process when the abandoned socket failed later. Timed-out sockets are destroyed, and events from replaced sockets are ignored.
- With RESP3 and `CLIENT TRACKING`, invalidation pushes were taken as command replies, so a `GET` could return another key's value.
- On RESP2, while a `SUBSCRIBE` was pending, a reply whose first element was `"message"` was dispatched as a Pub/Sub message, and the following replies shifted.
- Commands issued during a reconnect ran before `SELECT` and wrote to database 0, and a database chosen with `select()` was lost after a reconnect.
- Blocking commands timed out after `commandTimeout` while the server still blocked them, so an element popped afterwards was lost.
- Reconnects used a fixed interval and gave up after about two seconds without an event, so subscriber-only clients stopped receiving messages after short outages.
- `quit()` left pending commands to time out, or pending forever with `commandTimeout: 0`.
- `close` was declared but never emitted, so a lost connection showed only as a later `reconnected`.
- A handshake interrupted by a lost connection could continue on the next connection or report `ready` while disconnected or after `quit()`.
- A transaction lost its `WATCH` in a reconnect and committed anyway, also when `WATCH` was sent again, and a database selected inside a transaction was lost after a reconnect.
- A `MULTI` sent with `send()` was lost in a reconnect, so the commands after it ran one by one and `EXEC` failed. Those commands are refused now, and the `EXEC` returns `null`.
- `multi()` left `WATCH` armed after an empty `exec()`, a `discard()` or an `exec()` that rejected a failed call, so the next transaction was aborted. It also reported a refused `MULTI` as `EXECABORT` although the queued commands had run, ran `pipeline()` outside the transaction and threw a `TypeError` for `send`, `quit` and the event methods.
- `exec()` waited for the queued calls before sending the transaction, so commands sent after it in the same tick ran first, and calls queued after it joined its transaction. It sends at once now, and a call that queues no command makes it send `UNWATCH` and reject, with the call's own error when it has one.
- Commands sent before the client was ready could run after commands sent later, such as from a `ready` listener or after `await connect()`.
- A protocol chosen with `hello()` was lost in a reconnect, so a RESP3 client came back on RESP2 and refused every command while subscribed.
- A server that refused the connection, such as one in protected mode or at `maxclients`, was retried as if the connection had dropped, and its reason was not reported.
- A command that is not an array, such as `send([undefined])`, rejected every request sent in the same tick.
- Replies parsed before a protocol error in the same chunk were rejected with the parser error, although the server had executed their commands.
- An empty password was treated as none: `auth(user, '')` sent the username as the password, `hello()` skipped `AUTH`, and `authentication: { username, password: '' }` sent `AUTH <username>` and failed with `Authentication failed`. `hello()` also dropped an empty client name, which clears the name.
- `jsonArrpop(key, undefined, index)` ignored the index and popped the last element.
- Changing, clearing or reusing a command array after `send()` changed or dropped the commands sent, or left the promise pending. `send()` copies the arrays now.
- `send()` with an argument that is not an array split a string into one command per character, so `send('GET')` sent `G`, `E` and `T`, and never settled for a number.
- A user chosen at runtime with `auth()` or `hello()` was lost in a reconnect.
- Commands built from more than about 125,000 items, such as `bfInsert`, `cfInsert`, `hexpire`, `migrate` with `keys`, `pubsubNumsub`, `xread`, `xreadgroup` and the weights of `zinter`, threw a `RangeError` instead of being sent.
- A subscription to a channel name that is not valid UTF-8 was unsubscribed and restored with different bytes.
- Shard channels in different cluster slots were restored with one `SSUBSCRIBE`, which a cluster node refuses with `CROSSSLOT`, so all of them were lost.
- Connecting to a host name with several addresses, such as `localhost`, when every address refused, gave errors with an empty message. The message now lists the failed attempts.
- `TYPE` rejected module type names such as `ReJSON-RL`, `INFO` dropped fields with empty values, `REPLICAOF` rejected the reply for an existing primary, and `ROLE` rejected Sentinel replies.
- `geosearch`, `georadius`, `commandList`, `aclCat`, `pubsubChannels`, `pubsubShardchannels`, `functionList` and the scan iterators dropped empty-string options, so `scan({ match: '' })` returned every key, and `aclGenpass(0)` and a scan `count` of `0` were dropped as well. `sort()` rejected `{ store: undefined }`.
- A non-string argument, such as `undefined` from an optional property passed to `mset`, `hmset`, `mget` or `hmget`, failed every request sent in the same tick. Only that request is rejected now.
- An invalid `port` was retried for about two seconds before `connect()` rejected with `Connection failed after 20 retries.` It now rejects at once with a `SolidisConnectionError`.
- RESP3 doubles spelled `-nan`, as Redis 6.2 sends them, failed to parse, and long simple string replies split across many chunks took quadratic time.
- `bitop()` threw a plain `Error`, and an unparsable URI a `TypeError`; both are `SolidisError`s now. `uri` brackets IPv6 hosts, encodes the username, and masks a password that comes without a username.
- The parser re-read partially received arrays from the start on every chunk, so large replies took quadratic time.
- URIs ignored the database, did not decode percent-encoded credentials and kept the brackets of IPv6 hosts.
- RESP2 infinite scores failed to parse in `zscore`, `zrange` with scores, `zincrby` and `zmpop`, and `bzmpop` failed after the server had already popped the members.
- `bgsave`, `bgrewriteaof` and `reset` rejected their successful replies, and `ping` rejected while subscribed on RESP2.
- `xreadgroup` rejected the whole batch when the pending history held a deleted entry, and `XINFO` turned unknown values into `0`.
- Time-series commands placed `IGNORE` after `LABELS`, which created labels from its arguments, and `geosearchstore` did not send `storedist`.
- `__proto__` fields disappeared from returned records, RESP3 verbatim strings kept their `txt:` prefix, and `INFO` values containing `:` were cut short.
- `hrandfield` with a negative count lost duplicates, `jsonType` did not return `null` for a missing key with a JSONPath on RESP3, and `commandDocs` rejected every command that has subcommands, could not read the RESP3 set of history entries, never marked an argument optional or multiple, and left `docFlags` empty on RESP3.
- `jsonMerge(key, value)` sent no path, which the server refuses, and `jsonArrindex()` dropped `stop` without `start`. They now send `$` and a start of `0`.
- `functionStats()` rejected with `Invalid reply` while a function was running.
- Reply conversions for time-series `NaN` samples, JSON legacy paths, `CF.INFO`, `BITPOS`, `BITCOUNT`, `SORT` and `TYPE` were corrected.

### Security

- Error messages, stack traces and debug entries no longer list command arguments; a failed `AUTH` used to show the password, and a failed `SET` the value. Arguments the server quotes back, such as an ACL rule or the arguments of an unknown command, become `***`, also when the server joins several into one quoted span, as for an ACL selector.
- User data shaped like a Pub/Sub message is never dispatched as a `message` event on RESP2.
- An integer reply longer than 20 characters or a big number longer than 4,096 characters is returned as an error reply, and a length line longer than 20 characters or nesting deeper than 512 levels is a protocol error, so one reply can no longer stall the event loop. Errors about a malformed line quote at most 32 characters, and error messages are cut to 4,096 characters before masking.

### Performance

- Replies split across socket chunks parse in linear time, and a reply that spans chunks copies only its own bytes.
- Serialization measures each argument once, replies allocate less, and bulk replies are zero-copy views.
- In alternating benchmark runs against 0.4.0, throughput is on par or better across the suite.
- Replies and timeouts for tens of thousands of pipelines in flight take linear time. Masking looks each quoted span up instead of comparing it with every argument, and reads only the start of each argument.
- Error replies no longer capture a stack trace they then drop.
- Measured with each version's `npm run bundle`, the minimal client with `get` and `set` shrinks from 29,494 to 29,391 bytes.

## [0.4.0] and earlier

See the [GitHub releases](https://github.com/vcms-io/solidis/releases).

[Unreleased]: https://github.com/vcms-io/solidis/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/vcms-io/solidis/releases/tag/v0.4.0

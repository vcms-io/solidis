# Changelog

All notable changes to Solidis are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

This release rebuilds the client core around one guarantee: every reply reaches the request that asked for it. Sessions survive reconnects, replies have one shape across RESP2, RESP3 and module versions, and reads can return Buffers or BigInts on request.

> [!IMPORTANT]
> This release contains breaking changes. Follow [Upgrading from 0.4.x](#upgrading-from-04x) before you update.

### Highlights

- Replies can no longer reach the wrong request. RESP3 pushes, RESP2 data shaped like pub/sub messages, timed-out blocking commands and reconnects all keep requests and replies paired.
- A reconnect restores the session (authentication, protocol, selected database and subscriptions) before any queued command runs, with exponential, jittered backoff.
- Server errors reject with a `SolidisCommandError` whose `cause` is the server's `RespError`, and messages never contain command arguments.
- New `{ buffer: true }` and `{ bigint: true }` command options, per-request timeouts, and option types that reject combinations the server refuses.
- The CommonJS build loads again, and the minimal bundle shrinks from 29,457 to 26,057 bytes.

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

`send()` now rejects `CLIENT REPLY OFF`, `CLIENT REPLY SKIP`, `MONITOR`, `SYNC`, `PSYNC` and empty commands with a `SolidisRequesterError` before anything is written. `CLIENT REPLY ON` is still accepted. Use a dedicated tool such as `redis-cli` for monitoring and replication.

#### 3. Handle command errors through `cause`

A server error now always rejects the command with a `SolidisCommandError`. The message names the command but never its arguments, and `cause` is the `RespError` the server sent. `RespError` has a new `code` property.

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

- **Messages.** 0.4.x put every argument into the message, for example `[AUTH default <password>] Invalid reply: ...`. Messages are now `[COMMAND] <server message>`. A reply of an unexpected type is described by its shape, such as `[GET] Unexpected reply: Buffer(12)`, never by its content. Match on `error.cause.code` instead of parsing messages.
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

- **`send()`** is unchanged. Error replies stay in the returned arrays as `RespError` values unless `rejectOnPartialPipelineError` is enabled.

#### 4. Update code that reads changed results

| API                                  | 0.4.x                                                                          | Now                                                                             |
| :----------------------------------- | :----------------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| `pipeline(commands)`                 | Returned only the reply of the last command                                    | Returns one reply per command, in order                                         |
| `multi()` … `exec()`                 | Resolved `[null]` when `WATCH` aborted the transaction, and resolved EXECABORT | Resolves `null` when aborted; EXECABORT rejects with a `SolidisCommandError`    |
| `hrandfield(key, count, true)`       | `Record<string, string>`                                                       | `{ field, value }[]`, keeping the duplicates of a negative count                |
| `tsInfo(key)`                        | Raw fields as `Record<string, unknown>`                                        | `RespTimeSeriesInfo`, with `labels` as a record and `rules` as entries          |
| `tsMadd()`, `bfMadd()`, `bfInsert()` | Rejected the whole call when one item failed, after storing the others         | Resolve with a `RespError` in place of each failed item                         |
| `xreadgroup()`                       | Rejected the batch when it contained a deleted entry                           | Returns deleted entries as `{ id, fields: null }` (`RespStreamGroupReadResult`) |
| `xinfoGroups()`, `xinfoStream()`     | Turned unknown `entriesRead` and `lag` into `0`                                | `number \| null`                                                                |
| `tsMget()`                           | Rejected the call when a matching series had no samples                        | `timestamp` and `value` are `null` for a series without samples                 |
| `jsonObjkeys()`                      | Never `null`                                                                   | `null` for a missing key                                                        |
| `memoryStats()`                      | `db` was always empty                                                          | `db` is keyed by database index, with the hashtable overhead of each database   |
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

**Integers beyond `Number.MAX_SAFE_INTEGER`.** `incr`, `incrby`, `decr`, `decrby`, `hincrby`, `bitfield` and `bitfieldRo` rejected such results with an `Invalid reply` error. They still reject by default, now with `Unexpected reply: integer exceeds Number.MAX_SAFE_INTEGER` and the exact value as the error's `cause`. The server has already applied the command at that point, so do not retry it blindly. Pass `{ bigint: true }` to receive a `bigint`:

```typescript
const total = await client.incrby('counter', 10n, { bigint: true }); // bigint
```

#### 5. Update changed signatures

- `expireat(key, timestamp, { notExists: true })` becomes `expireat(key, timestamp, 'NX')`. The mode is `'NX'`, `'XX'`, `'GT'` or `'LT'`, as for `expire`, `pexpire` and `pexpireat`.
- `zintercard(keys, limit, options)` loses `options`. The server accepts neither `WEIGHTS` nor `AGGREGATE` for `ZINTERCARD`.

#### 6. Fix option combinations the types now reject

Option types follow the command grammar through the new `CommandExclusiveOptions` helper. Code that passes conflicting options no longer compiles. The server rejected most of these combinations anyway.

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

#### 7. Review connection settings and error listeners

- **URI precedence.** Explicit options now take precedence over the parts of `uri`. In 0.4.x, the host and port of the URI overrode `host` and `port`.

  ```typescript
  const client = new SolidisClient({ uri: 'redis://cache.internal:6380/2', port: 6379 });
  // 0.4.x: port 6380, and the database in the path was ignored
  // Now:   port 6379 and database 2
  ```

- **URI parsing.** The database in the path is applied, percent-encoded credentials are decoded, and bracketed IPv6 hosts work. A scheme other than `redis:` or `rediss:`, or an invalid database, makes the constructor throw a `SolidisClientError`.
- **Reconnect delay.** `connectionRetryDelay` was a fixed delay between attempts. It is now the first delay of an exponential backoff that doubles after each failed attempt, is capped by `maxConnectionRetryDelay` (default `2000` ms) and is jittered to 50–100%. With the defaults, the waits between the 20 retries add up to 17–33 seconds instead of 2 seconds. Lower `maxConnectionRetries` or `maxConnectionRetryDelay` if you need to fail faster.
- **Unhandled errors.** An `error` event without a listener used to reach only the debug log. It is now also passed to `process.emitWarning()`. Add a listener to handle errors yourself:

  ```typescript
  client.on('error', (error) => logger.warn(error));
  ```

#### 8. Update code that uses internal classes or command helpers

Skip this step unless you construct the internal classes yourself or write custom commands.

- **`SolidisConnection`:** `socket` and `cleanup()` are removed, and `reconnect()`, `write(buffer)`, `reset(error)` and `resetBackoff()` are added. The `closed` and `reconnected` events are replaced by `close(error)` and `reconnecting(attempt, delay)`, and `data` and `drain` are new.
- **`SolidisRequester`:** `setNegotiatedProtocol()`, `onReply()` and `recoveryFromFault()` are removed. The requester tracks `protocol` and `database` itself, `send()` takes request options, and its options require an `emit` function.
- **`SolidisParser`:** the constructor takes `{ parser }` options, and the asynchronous `queueParse(...buffers)` is replaced by the synchronous `parse(chunk)`.
- **`SolidisPubSub`:** the constructor takes the client's `emit`. The per-kind getters and clear methods, `getChannelsForUnsubscribeCommand()` and `dispatchPubSubEvent()` are replaced by `getSubscriptions()`, `clearSubscriptions()`, `clear()`, `dispatchMessage()` and `dispatchSubscriptionChange()`.
- **`SolidisDebugMemory`:** now an `EventEmitter` with a plain `write(entry)` instead of a `Writable` stream. `SolidisDebugTransform` is replaced by `formatDebugLog(entry)`.
- **Command helpers** in `@vcms-io/solidis/command/utils/*`:
  - `guard()` only requires a `send()` method, and `assertSender()` is new.
  - `executeCommand()` takes request options and rejects error replies.
  - `newCommandError(message, commandName, cause)` replaces the `prefix` parameter with a command name and an optional cause.
  - `tryReplyArray()` returns `unknown[]`, and `tryReplyToStringArray()` no longer has a `nullable` overload; use `tryReplyToNullableStringArray()`.
  - Removed: `InvalidReplyPrefix`, `tryReplyToStringRecordRecursively()` and `tryReplyToSortedSetMembersOrNull()`, and from `common/utils`, `checkReplyIsArray()` and `checkReplyIsMessageEvent()`.
  - Added: `tryReplyTuple()`, `tryReplyToInteger()`, `tryReplyToStringOrBuffer()` with its nullable, array and record variants, `executeIntegerCommand()`, `newUnexpectedReplyError()` and `describeReply()`.
- **Removed types:** `SolidisRecursiveStringRecord`, `RespClientReplyMode`, `RespAclLogKey`, `RespAclLogNumberKey`, and the internal parser and pipeline types such as `SolidisParsed` and `SolidisPipelineRequest`.

### Added

- `{ buffer: true }` returns the exact bytes as a `Buffer` from `get`, `getdel`, `getex`, `getrange`, `mget`, `hget`, `hmget`, `hgetall`, `hvals`, `lindex`, `lrange`, `lpop`, `rpop`, `lmove`, `blmove`, `rpoplpush`, `brpoplpush`, `blpop`, `brpop`, `lmpop` and `blmpop`. `mget` and `hmget` take it after their keys or fields, as in `mget('a', 'b', { buffer: true })`.
- `{ bigint: true }` returns a `bigint` from `incr`, `incrby`, `decr`, `decrby`, `hincrby`, `bitfield` and `bitfieldRo`. Increments and bitfield values accept `bigint`.
- `append`, `msetnx`, `lpush`, `rpush`, `lpushx`, `lset`, `linsert`, `lrem` and `lpos` accept `Buffer` values.
- `send(commands, { timeout })` gives one request its own deadline, both while waiting for the connection and for the reply.
- `maxConnectionRetryDelay` caps the reconnect backoff.
- The `reconnecting(attempt, delay)` and `push(reply)` events, and the cause as the argument of `close(error)`. `push` carries RESP3 pushes that are not pub/sub messages, such as client tracking invalidations.
- `expire(key, seconds, mode)`, `lpop(key, count)` and `rpop(key, count)`.
- `RespError#code`, and `deletedIds` in the result of `xautoclaim()`.
- Types: `CommandExclusiveOptions`, `CommandBufferOptions`, `CommandIntegerOptions`, `RespString`, `RespInteger`, `SolidisSendOptions`, `RespHashEntry`, `RespTimeSeriesInfo`, `RespTimeSeriesRule`, `RespStreamDeletedEntry` and `RespStreamGroupReadResult`.
- Utilities: `parseConnectionUri()`, `resolveClientOptions()`, `getCommandName()`, `parseDouble()`, `formatDouble()` and `formatDebugLog()`.

### Changed

- Commands wait until the handshake (authentication, `HELLO`, `SELECT`, client name and ready check) has finished, bounded by `commandTimeout` or the request's `timeout`.
- RESP3 connections authenticate with a single `HELLO 3 AUTH`, and `WRONGPASS` or `NOAUTH` fails the connection instead of continuing unauthenticated.
- After a reconnect, the client restores the database selected at runtime and each kind of subscription, and forgets a kind the server refuses.
- Blocking commands (`blpop`, `brpop`, `blmove`, `blmpop`, `brpoplpush`, `bzpopmin`, `bzpopmax`, `bzmpop`, `xread` and `xreadgroup` with `block`, `wait` and `waitaof`) run in a pipeline of their own. Their deadline is `commandTimeout` plus their own timeout, and they have none when they block forever.
- When a blocking pipeline or every in-flight pipeline times out, the connection is reset, so a late reply can never reach a later command.
- `quit()` rejects pending commands at once with a `SolidisClientError`.
- Pipelines go to the socket as soon as they are sealed instead of waiting for `drain` after each write.
- Bulk replies of 64 KB or more are returned as views of the received data instead of copies.
- `zpopmin`, `zpopmax`, `bitfield`, `jsonNumincrby` and `jsonNummultby` never return `null`, and `type()` also returns module type names.
- Commands added with `extend()` keep their generic signatures, so options such as `{ buffer: true }` type their results.

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
- Reconnects used a fixed interval and gave up after about two seconds, so subscriber-only clients stopped receiving messages after short outages without any event.
- `quit()` left pending commands to time out, or pending forever with `commandTimeout: 0`.
- A lost connection emitted no event; `close` was declared but never emitted.
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

- Error messages and stack traces no longer contain command arguments. A failed `AUTH` used to put the password into the message, and a failed `SET` the value.
- User data shaped like a pub/sub message can no longer be dispatched as a `message` event on RESP2.

### Performance

- The parser handles replies split across socket chunks in linear time.
- Serialization measures each argument once, and each reply allocates less.
- In alternating benchmark runs against 0.4.0, throughput is on par or better across the suite.
- The minimal client with `get` and `set` shrinks from 29,457 to 26,057 bytes, and the featured client from 99,356 to 91,796 bytes.

## [0.4.0] and earlier

See the [GitHub releases](https://github.com/vcms-io/solidis/releases).

[Unreleased]: https://github.com/vcms-io/solidis/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/vcms-io/solidis/releases/tag/v0.4.0

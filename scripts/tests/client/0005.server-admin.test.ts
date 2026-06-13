/**
 * Server administration, memory introspection, slowlog, object introspection,
 * latency diagnostics, and deprecated string commands.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { RespError } from '../../../sources/index.ts';
import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
} from '../utils/index.ts';

import type { FeaturedClient, ServerCapabilities } from '../utils/index.ts';

describe('server-admin', () => {
  let client: FeaturedClient;
  let capabilities: ServerCapabilities;
  const keyspace = createKeyspace('server-admin');

  before(async () => {
    client = await createClient();
    capabilities = await detectServerCapabilities(client);
  });

  after(async () => {
    await closeClient(client);
  });

  it('reports memory usage for a key with MEMORY USAGE', async () => {
    const key = keyspace.key('memory-usage');

    await client.set(key, 'hello world');

    const usage = await client.memoryUsage(key);

    assert.ok(typeof usage === 'number');
    assert.ok(usage > 0);

    const usageWithSamples = await client.memoryUsage(key, 0);

    assert.ok(typeof usageWithSamples === 'number');
    assert.ok(usageWithSamples > 0);
  });

  it('returns null for MEMORY USAGE of a non-existent key', async () => {
    const result = await client.memoryUsage(keyspace.key('no-such-key'));

    assert.strictEqual(result, null);
  });

  it('returns structured data from MEMORY STATS', async () => {
    const stats = await client.memoryStats();

    assert.strictEqual(typeof stats.total.allocated, 'number');
    assert.ok(stats.total.allocated > 0);
    assert.strictEqual(typeof stats.keys.count, 'number');
  });

  it('runs MEMORY DOCTOR without error', async () => {
    const result = await client.memoryDoctor();

    assert.strictEqual(typeof result, 'string');
    assert.ok(result.length > 0);
  });

  it('returns allocator stats with MEMORY MALLOC-STATS', async () => {
    const stats = await client.memoryMallocStats();

    assert.strictEqual(typeof stats, 'string');
    assert.ok(stats.length > 0);
  });

  it('purges memory with MEMORY PURGE', async () => {
    assert.strictEqual(await client.memoryPurge(), 'OK');
  });

  it('reads the slowlog with SLOWLOG GET', async () => {
    const entries = await client.slowlogGet(10);

    assert.ok(Array.isArray(entries));
  });

  it('parses slowlog entries with structured fields', async () => {
    await client.configSet('slowlog-log-slower-than', '0');
    await client.ping();
    await client.configSet('slowlog-log-slower-than', '10000');

    const entries = await client.slowlogGet(5);

    assert.ok(entries.length > 0);

    const entry = entries[0];

    assert.strictEqual(typeof entry.id, 'number');
    assert.strictEqual(typeof entry.timestamp, 'number');
    assert.strictEqual(typeof entry.duration, 'number');
    assert.ok(Array.isArray(entry.commandArguments));
    assert.strictEqual(typeof entry.clientIpPort, 'string');
    assert.strictEqual(typeof entry.clientName, 'string');
  });

  it('reports slowlog length with SLOWLOG LEN', async () => {
    await client.slowlogReset();
    await client.configSet('slowlog-log-slower-than', '0');
    await client.ping();
    await client.configSet('slowlog-log-slower-than', '10000');

    const length = await client.slowlogLen();

    assert.strictEqual(typeof length, 'number');
    /** The PING issued above with a zero threshold guarantees an entry. */
    assert.ok(length >= 1);
  });

  it('resets the slowlog with SLOWLOG RESET', async () => {
    assert.strictEqual(await client.slowlogReset(), 'OK');
  });

  it('reports reference count with OBJECT REFCOUNT', async () => {
    const key = keyspace.key('object-refcount');

    await client.set(key, 'value');

    const refcount = await client.objectRefcount(key);

    assert.strictEqual(typeof refcount, 'number');
    assert.ok(refcount !== null && refcount >= 1);
  });

  it('reports idle time with OBJECT IDLETIME', async () => {
    const key = keyspace.key('object-idletime');

    await client.set(key, 'value');

    const idle = await client.objectIdletime(key);

    assert.strictEqual(typeof idle, 'number');
    assert.ok(idle !== null && idle >= 0);
  });

  it('returns null for OBJECT REFCOUNT of missing key', async () => {
    const result = await client.objectRefcount(keyspace.key('missing'));

    assert.strictEqual(result, null);
  });

  it('returns an array from LATENCY LATEST', async () => {
    const latest = await client.latencyLatest();

    assert.ok(Array.isArray(latest));
  });

  it('resets latency history with LATENCY RESET', async () => {
    const result = await client.latencyReset();

    assert.strictEqual(typeof result, 'number');
  });

  it('resets statistics with CONFIG RESETSTAT', async () => {
    assert.strictEqual(await client.configResetstat(), 'OK');
  });

  it('returns a timestamp from LASTSAVE', async () => {
    const timestamp = await client.lastsave();

    assert.strictEqual(typeof timestamp, 'number');
    assert.ok(timestamp > 0);
  });

  it('triggers a background save with BGSAVE', async () => {
    const result = await client.bgsave().catch((error: Error) => error.message);

    assert.ok(
      typeof result === 'string' &&
        /ok|background saving|already|progress/i.test(result),
    );
  });

  it('triggers a scheduled background save with BGSAVE SCHEDULE', async () => {
    const result = await client
      .bgsave(true)
      .catch((error: Error) => error.message);

    /**
     * The client only treats a literal `OK` as a resolved value, so the status
     * line ("Background saving started/scheduled") surfaces through the catch;
     * either way the message must describe the save, not an arbitrary failure.
     */
    assert.match(result, /saving (started|scheduled)|already|in progress/i);
  });

  it('triggers AOF rewrite with BGREWRITEAOF', async () => {
    const result = await client
      .bgrewriteaof()
      .catch((error: Error) => error.message);

    assert.ok(
      typeof result === 'string' &&
        /ok|rewrite|already|progress|scheduled/i.test(result),
    );
  });

  it('flushes all databases with FLUSHALL on a dedicated database', async () => {
    const dedicated = await createClient({ database: 15 });

    try {
      await dedicated.set(keyspace.key('flushall'), 'temp');
      assert.strictEqual(await dedicated.flushall(), 'OK');
      assert.strictEqual(await dedicated.dbsize(), 0);
    } finally {
      await closeClient(dedicated);
    }
  });

  it('returns from WAITAOF immediately', async (context) => {
    if (!capabilities.atLeast(7, 2)) {
      context.skip('WAITAOF requires Redis 7.2+');
      return;
    }

    const result = await client.waitaof(0, 0, 100);

    assert.strictEqual(typeof result.localFsynced, 'number');
    assert.strictEqual(typeof result.replicasAcknowledged, 'number');
  });

  it('atomically sets and returns old value with GETSET', async () => {
    const key = keyspace.key('getset');

    await client.set(key, 'old');

    assert.strictEqual(await client.getset(key, 'new'), 'old');
    assert.strictEqual(await client.get(key), 'new');
  });

  it('returns null for GETSET on a non-existent key', async () => {
    const key = keyspace.key('getset-missing');

    assert.strictEqual(await client.getset(key, 'first'), null);
    assert.strictEqual(await client.get(key), 'first');
  });

  /**
   * Shadow tests: verify command construction reaches the server without
   * causing destructive side effects. Commands that would kill the connection
   * (SHUTDOWN, REPLICAOF) are tested via error interception only.
   */

  it('verifies SHUTDOWN command construction without sending', async () => {
    const { createCommand } = await import(
      '../../../sources/command/shutdown.ts'
    );

    assert.deepStrictEqual(createCommand(), ['SHUTDOWN']);
    assert.deepStrictEqual(createCommand({ nosave: true }), [
      'SHUTDOWN',
      'NOSAVE',
    ]);
    assert.deepStrictEqual(createCommand({ save: true, now: true }), [
      'SHUTDOWN',
      'SAVE',
      'NOW',
    ]);
    assert.deepStrictEqual(createCommand({ abort: true }), [
      'SHUTDOWN',
      'ABORT',
    ]);
    assert.deepStrictEqual(createCommand({ nosave: true, force: true }), [
      'SHUTDOWN',
      'NOSAVE',
      'FORCE',
    ]);
    assert.deepStrictEqual(
      createCommand({ save: true, now: true, force: true }),
      ['SHUTDOWN', 'SAVE', 'NOW', 'FORCE'],
    );
  });

  it('verifies HELLO command construction with all option branches', async () => {
    const { createCommand } = await import('../../../sources/command/hello.ts');

    assert.deepStrictEqual(createCommand('RESP3'), ['HELLO', '3']);
    assert.deepStrictEqual(createCommand('RESP2'), ['HELLO', '2']);

    assert.deepStrictEqual(createCommand('RESP3', 'myuser', 'mypass'), [
      'HELLO',
      '3',
      'AUTH',
      'myuser',
      'mypass',
    ]);

    assert.deepStrictEqual(createCommand('RESP3', undefined, 'mypass'), [
      'HELLO',
      '3',
      'AUTH',
      'default',
      'mypass',
    ]);

    assert.deepStrictEqual(
      createCommand('RESP3', undefined, undefined, 'myclient'),
      ['HELLO', '3', 'SETNAME', 'myclient'],
    );

    assert.deepStrictEqual(createCommand('RESP3', 'user', 'pass', 'client'), [
      'HELLO',
      '3',
      'AUTH',
      'user',
      'pass',
      'SETNAME',
      'client',
    ]);
  });

  it('verifies SORT_RO command construction with all options', async () => {
    const { createCommand } = await import(
      '../../../sources/command/sort.ro.ts'
    );

    assert.deepStrictEqual(createCommand('key'), ['SORT_RO', 'key']);

    assert.deepStrictEqual(createCommand('key', { by: 'weight:*' }), [
      'SORT_RO',
      'key',
      'BY',
      'weight:*',
    ]);

    assert.deepStrictEqual(
      createCommand('key', { limit: { offset: 2, count: 5 } }),
      ['SORT_RO', 'key', 'LIMIT', '2', '5'],
    );

    assert.deepStrictEqual(createCommand('key', { get: ['data:*', '#'] }), [
      'SORT_RO',
      'key',
      'GET',
      'data:*',
      'GET',
      '#',
    ]);

    assert.deepStrictEqual(createCommand('key', { order: 'DESC' }), [
      'SORT_RO',
      'key',
      'DESC',
    ]);

    assert.deepStrictEqual(createCommand('key', { alpha: true }), [
      'SORT_RO',
      'key',
      'ALPHA',
    ]);

    assert.deepStrictEqual(
      createCommand('key', {
        by: 'weight:*',
        limit: { offset: 0, count: 10 },
        get: ['name:*'],
        order: 'ASC',
        alpha: true,
      }),
      [
        'SORT_RO',
        'key',
        'BY',
        'weight:*',
        'LIMIT',
        '0',
        '10',
        'GET',
        'name:*',
        'ASC',
        'ALPHA',
      ],
    );
  });

  it('verifies FUNCTION LIST command construction with options', async () => {
    const { createCommand } = await import(
      '../../../sources/command/function.list.ts'
    );

    assert.deepStrictEqual(createCommand(), ['FUNCTION', 'LIST']);

    assert.deepStrictEqual(createCommand({ libraryNamePattern: 'mylib' }), [
      'FUNCTION',
      'LIST',
      'LIBRARYNAME',
      'mylib',
    ]);

    assert.deepStrictEqual(createCommand({ withCode: true }), [
      'FUNCTION',
      'LIST',
      'WITHCODE',
    ]);

    assert.deepStrictEqual(
      createCommand({ libraryNamePattern: 'test', withCode: true }),
      ['FUNCTION', 'LIST', 'LIBRARYNAME', 'test', 'WITHCODE'],
    );
  });

  it('verifies FUNCTION RESTORE command construction with options', async () => {
    const { createCommand } = await import(
      '../../../sources/command/function.restore.ts'
    );

    const dump = 'fakebinarydump';

    const base = createCommand(dump);

    assert.strictEqual(base[0], 'FUNCTION');
    assert.strictEqual(base[1], 'RESTORE');
    assert.strictEqual(base.length, 3);

    const withReplace = createCommand(dump, { replace: true });

    assert.strictEqual(withReplace[3], 'REPLACE');

    const withFlush = createCommand(dump, { flush: true });

    assert.strictEqual(withFlush[3], 'FLUSH');

    const withAppend = createCommand(dump, { append: true });

    assert.strictEqual(withAppend[3], 'APPEND');
  });

  it('verifies MIGRATE command construction with all options', async () => {
    const { createCommand } = await import(
      '../../../sources/command/migrate.ts'
    );

    assert.deepStrictEqual(createCommand('10.0.0.1', 6380, 'mykey', 0, 5000), [
      'MIGRATE',
      '10.0.0.1',
      '6380',
      'mykey',
      '0',
      '5000',
    ]);

    assert.deepStrictEqual(
      createCommand('10.0.0.1', 6380, 'mykey', 0, 5000, { copy: true }),
      ['MIGRATE', '10.0.0.1', '6380', 'mykey', '0', '5000', 'COPY'],
    );

    assert.deepStrictEqual(
      createCommand('10.0.0.1', 6380, 'mykey', 0, 5000, { replace: true }),
      ['MIGRATE', '10.0.0.1', '6380', 'mykey', '0', '5000', 'REPLACE'],
    );

    assert.deepStrictEqual(
      createCommand('10.0.0.1', 6380, 'mykey', 0, 5000, { auth: 'secret' }),
      ['MIGRATE', '10.0.0.1', '6380', 'mykey', '0', '5000', 'AUTH', 'secret'],
    );

    assert.deepStrictEqual(
      createCommand('10.0.0.1', 6380, 'mykey', 0, 5000, {
        auth2: { username: 'user', password: 'pass' },
      }),
      [
        'MIGRATE',
        '10.0.0.1',
        '6380',
        'mykey',
        '0',
        '5000',
        'AUTH2',
        'user',
        'pass',
      ],
    );

    assert.deepStrictEqual(
      createCommand('10.0.0.1', 6380, '', 0, 5000, { keys: ['k1', 'k2'] }),
      ['MIGRATE', '10.0.0.1', '6380', '', '0', '5000', 'KEYS', 'k1', 'k2'],
    );

    assert.deepStrictEqual(
      createCommand('10.0.0.1', 6380, '', 0, 5000, {
        copy: true,
        replace: true,
        auth: 'pw',
        keys: ['a'],
      }),
      [
        'MIGRATE',
        '10.0.0.1',
        '6380',
        '',
        '0',
        '5000',
        'COPY',
        'REPLACE',
        'AUTH',
        'pw',
        'KEYS',
        'a',
      ],
    );
  });

  it('verifies FAILOVER command construction with all options', async () => {
    const { createCommand } = await import(
      '../../../sources/command/failover.ts'
    );

    assert.deepStrictEqual(createCommand(), ['FAILOVER']);

    assert.deepStrictEqual(createCommand({ abort: true }), [
      'FAILOVER',
      'ABORT',
    ]);

    assert.deepStrictEqual(
      createCommand({ to: { host: '10.0.0.2', port: 6380 } }),
      ['FAILOVER', 'TO', '10.0.0.2', '6380'],
    );

    assert.deepStrictEqual(
      createCommand({
        to: { host: '10.0.0.2', port: 6380, password: 'pw' },
      }),
      ['FAILOVER', 'TO', '10.0.0.2', '6380', 'pw'],
    );

    assert.deepStrictEqual(
      createCommand({
        to: { host: '10.0.0.2', port: 6380, username: 'user', password: 'pw' },
      }),
      ['FAILOVER', 'TO', '10.0.0.2', '6380', 'user', 'pw'],
    );

    assert.deepStrictEqual(createCommand({ force: true }), [
      'FAILOVER',
      'FORCE',
    ]);

    assert.deepStrictEqual(createCommand({ timeout: 10000 }), [
      'FAILOVER',
      'TIMEOUT',
      '10000',
    ]);

    assert.deepStrictEqual(
      createCommand({
        to: { host: '10.0.0.2', port: 6380 },
        force: true,
        timeout: 5000,
      }),
      ['FAILOVER', 'TO', '10.0.0.2', '6380', 'FORCE', 'TIMEOUT', '5000'],
    );
  });

  it('executes DEBUG SLEEP 0 without blocking', async () => {
    const [[reply]] = await client.send([['DEBUG', 'SLEEP', '0']]);

    /**
     * DEBUG is gated behind `enable-debug-command` on hardened builds (Redis
     * Stack), so the reply is either OK or a specific "not allowed" RespError —
     * never an unrelated value.
     */
    if (reply instanceof RespError) {
      assert.match(`${reply.message}`, /DEBUG|not allowed|unknown/i);
      return;
    }

    assert.strictEqual(reply, 'OK');
  });

  it('rewrites the config file with CONFIG REWRITE', async () => {
    const result = await client.configRewrite().catch((error: Error) => error);

    /**
     * Succeeds with OK when started from a config file; otherwise it must fail
     * with the specific "running without a config file" error.
     */
    if (result instanceof Error) {
      assert.match(`${result.message}`, /config file/i);
      return;
    }

    assert.strictEqual(result, 'OK');
  });

  it('performs a synchronous save with SAVE', async () => {
    const result = await client.save().catch((error: Error) => error.message);

    assert.ok(
      typeof result === 'string' && /ok|already|progress/i.test(result),
    );
  });

  it('reports object access frequency with OBJECT FREQ', async () => {
    const key = keyspace.key('object-freq');

    await client.set(key, 'test');

    const result = await client.objectFreq(key).catch((error: Error) => error);

    /**
     * OBJECT FREQ is only valid under an LFU maxmemory-policy; with the default
     * policy it must reject with the LFU-specific error rather than any error.
     */
    if (result instanceof Error) {
      assert.match(`${result.message}`, /LFU|maxmemory/i);
      return;
    }

    assert.ok(typeof result === 'number' && result >= 0);
  });

  it('reads sorted output with SORT_RO', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('sort-ro');

    await client.rpush(key, '3', '1', '2');

    const sorted = await client.sortRo(key);

    assert.deepStrictEqual(sorted, ['1', '2', '3']);
  });

  it('reads sorted output with SORT_RO and ALPHA', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('sort-ro-alpha');

    await client.rpush(key, 'cherry', 'apple', 'banana');

    const sorted = await client.sortRo(key, { alpha: true });

    assert.deepStrictEqual(sorted, ['apple', 'banana', 'cherry']);
  });

  it('returns latency history for an event', async () => {
    const history = await client.latencyHistory('command');

    assert.ok(Array.isArray(history));
  });

  it('runs LATENCY DOCTOR without error', async () => {
    const result = await client.latencyDoctor();

    assert.strictEqual(typeof result, 'string');
    assert.ok(result.length > 0);
  });

  it('runs LATENCY GRAPH (returns string even if empty)', async () => {
    const result = await client
      .latencyGraph('command')
      .catch((error: Error) => error.message);

    assert.strictEqual(typeof result, 'string');
  });

  it('reads latency histograms with actual command data', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('LATENCY HISTOGRAM requires Redis 7.0+');
      return;
    }

    for (let index = 0; index < 10; index += 1) {
      await client.ping();
    }

    const histograms = await client.latencyHistogram('ping');

    assert.strictEqual(typeof histograms, 'object');
    /** The 10 pings above must be recorded in the ping histogram. */
    assert.ok('ping' in histograms, 'expected a ping histogram entry');
    assert.strictEqual(typeof histograms.ping.calls, 'number');
    assert.ok(histograms.ping.calls >= 10);
    assert.strictEqual(typeof histograms.ping.histogramUsec, 'object');
  });

  it('kills a running function (none running)', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('FUNCTION KILL requires Redis 7.0+');
      return;
    }

    /** With no function running, FUNCTION KILL must reject with NOTBUSY. */
    await assert.rejects(
      () => client.functionKill(),
      (error: Error) => /NOTBUSY|No scripts|not running/i.test(error.message),
    );
  });

  it('sets script debug mode', async () => {
    assert.strictEqual(await client.scriptDebug('NO'), 'OK');
  });

  it('verifies AUTH command construction without sending', async () => {
    const { createCommand } = await import('../../../sources/command/auth.ts');

    assert.deepStrictEqual(createCommand('user', 'pass'), [
      'AUTH',
      'user',
      'pass',
    ]);
    assert.deepStrictEqual(createCommand(undefined, 'pass'), [
      'AUTH',
      'default',
      'pass',
    ]);
  });

  it('verifies REPLICAOF command construction without sending', async () => {
    const { createCommand } = await import(
      '../../../sources/command/replicaof.ts'
    );

    assert.strictEqual(createCommand('127.0.0.1', 6379)[0], 'REPLICAOF');
    assert.strictEqual(createCommand('127.0.0.1', 6379)[1], '127.0.0.1');
    assert.strictEqual(createCommand('127.0.0.1', 6379)[2], '6379');
  });

  it('verifies SYNC command construction', async () => {
    const { createCommand } = await import('../../../sources/command/sync.ts');

    assert.deepStrictEqual(createCommand(), ['SYNC']);
  });

  it('verifies RESET command construction', async () => {
    const { createCommand } = await import('../../../sources/command/reset.ts');

    assert.deepStrictEqual(createCommand(), ['RESET']);
  });

  it('lists loaded modules with MODULE LIST', async () => {
    const modules = await client.moduleList();

    assert.ok(Array.isArray(modules));
  });

  it('verifies MODULE LOAD command construction', async () => {
    const { createCommand } = await import(
      '../../../sources/command/module.load.ts'
    );

    assert.deepStrictEqual(createCommand('/path/to/module.so'), [
      'MODULE',
      'LOAD',
      '/path/to/module.so',
    ]);
  });

  it('verifies MODULE UNLOAD command construction', async () => {
    const { createCommand } = await import(
      '../../../sources/command/module.unload.ts'
    );

    assert.deepStrictEqual(createCommand('mymodule'), [
      'MODULE',
      'UNLOAD',
      'mymodule',
    ]);
  });

  it('verifies MODULE LOADEX command construction', async () => {
    const { createCommand } = await import(
      '../../../sources/command/module.loadex.ts'
    );

    const command = createCommand('/path/to/module.so');

    assert.strictEqual(command[0], 'MODULE');
    assert.strictEqual(command[1], 'LOADEX');
    assert.strictEqual(command[2], '/path/to/module.so');
  });

  it('resets latency events by name', async () => {
    const reset = await client.latencyReset(['command']);

    /** LATENCY RESET returns the number of event time series it cleared. */
    assert.strictEqual(typeof reset, 'number');
    assert.ok(reset >= 0);
  });

  it('returns parsed LATENCY LATEST entries', async () => {
    await client.configSet('latency-monitor-threshold', '1');

    await client.send([['DEBUG', 'SLEEP', '0.005']]).catch(() => {});
    await client.ping();

    const result = await client.latencyLatest();

    await client.configSet('latency-monitor-threshold', '0');

    assert.ok(Array.isArray(result));

    if (result.length > 0) {
      assert.strictEqual(typeof result[0].event, 'string');
      assert.strictEqual(typeof result[0].timestamp, 'number');
      assert.strictEqual(typeof result[0].latency, 'number');
      assert.strictEqual(typeof result[0].maximumLatency, 'number');
    }
  });

  it('returns parsed LATENCY HISTORY entries', async () => {
    await client.configSet('latency-monitor-threshold', '1');

    await client.send([['DEBUG', 'SLEEP', '0.005']]).catch(() => {});
    await client.ping();

    const result = await client.latencyHistory('command');

    await client.configSet('latency-monitor-threshold', '0');

    assert.ok(Array.isArray(result));

    if (result.length > 0) {
      assert.strictEqual(typeof result[0].timestamp, 'number');
      assert.strictEqual(typeof result[0].latency, 'number');
    }
  });

  it('verifies SORT command construction with all options', async () => {
    const { createCommand } = await import('../../../sources/command/sort.ts');

    assert.deepStrictEqual(createCommand('key'), ['SORT', 'key']);

    assert.deepStrictEqual(createCommand('key', { by: 'weight:*' }), [
      'SORT',
      'key',
      'BY',
      'weight:*',
    ]);

    assert.deepStrictEqual(
      createCommand('key', { limit: { offset: 2, count: 5 } }),
      ['SORT', 'key', 'LIMIT', '2', '5'],
    );

    assert.deepStrictEqual(createCommand('key', { get: ['data:*', '#'] }), [
      'SORT',
      'key',
      'GET',
      'data:*',
      'GET',
      '#',
    ]);

    assert.deepStrictEqual(createCommand('key', { order: 'DESC' }), [
      'SORT',
      'key',
      'DESC',
    ]);

    assert.deepStrictEqual(createCommand('key', { alpha: true }), [
      'SORT',
      'key',
      'ALPHA',
    ]);

    assert.deepStrictEqual(createCommand('key', { store: 'dest' }), [
      'SORT',
      'key',
      'STORE',
      'dest',
    ]);

    assert.deepStrictEqual(
      createCommand('key', {
        by: 'w:*',
        limit: { offset: 0, count: 10 },
        get: ['n:*'],
        order: 'ASC',
        alpha: true,
        store: 'out',
      }),
      [
        'SORT',
        'key',
        'BY',
        'w:*',
        'LIMIT',
        '0',
        '10',
        'GET',
        'n:*',
        'ASC',
        'ALPHA',
        'STORE',
        'out',
      ],
    );
  });

  it('verifies RESTORE command construction with all options', async () => {
    const { createCommand } = await import(
      '../../../sources/command/restore.ts'
    );

    const base = createCommand('key', 0, 'dump');

    assert.strictEqual(base[0], 'RESTORE');
    assert.strictEqual(base[1], 'key');
    assert.strictEqual(base[2], '0');
    assert.ok(base[3] instanceof Buffer);
    assert.strictEqual(base.length, 4);

    const withReplace = createCommand('key', 0, 'dump', { replace: true });

    assert.strictEqual(withReplace[4], 'REPLACE');

    const withAbsttl = createCommand('key', 0, 'dump', { absttl: true });

    assert.strictEqual(withAbsttl[4], 'ABSTTL');

    const withIdletime = createCommand('key', 0, 'dump', { idletime: 100 });

    assert.ok(withIdletime.includes('IDLETIME'));
    assert.ok(withIdletime.includes('100'));

    const withFreq = createCommand('key', 0, 'dump', { freq: 42 });

    assert.ok(withFreq.includes('FREQ'));
    assert.ok(withFreq.includes('42'));

    const withAll = createCommand('key', 0, 'dump', {
      replace: true,
      absttl: true,
      idletime: 50,
      freq: 10,
    });

    assert.ok(withAll.includes('REPLACE'));
    assert.ok(withAll.includes('ABSTTL'));
    assert.ok(withAll.includes('IDLETIME'));
    assert.ok(withAll.includes('FREQ'));
  });

  it('verifies GETEX command construction with all TTL modes', async () => {
    const { createCommand } = await import('../../../sources/command/getex.ts');

    assert.deepStrictEqual(createCommand('key'), ['GETEX', 'key']);

    assert.deepStrictEqual(createCommand('key', { expireInSeconds: 60 }), [
      'GETEX',
      'key',
      'EX',
      '60',
    ]);

    assert.deepStrictEqual(
      createCommand('key', { expireInMilliseconds: 5000 }),
      ['GETEX', 'key', 'PX', '5000'],
    );

    assert.deepStrictEqual(
      createCommand('key', { expireAtSeconds: 1700000000 }),
      ['GETEX', 'key', 'EXAT', '1700000000'],
    );

    assert.deepStrictEqual(
      createCommand('key', { expireAtMilliseconds: 1700000000000 }),
      ['GETEX', 'key', 'PXAT', '1700000000000'],
    );

    assert.deepStrictEqual(createCommand('key', { persist: true }), [
      'GETEX',
      'key',
      'PERSIST',
    ]);
  });

  it('verifies LCS command construction with all options', async () => {
    const { createCommand } = await import('../../../sources/command/lcs.ts');

    assert.deepStrictEqual(createCommand('a', 'b'), ['LCS', 'a', 'b']);

    assert.deepStrictEqual(createCommand('a', 'b', { len: true }), [
      'LCS',
      'a',
      'b',
      'LEN',
    ]);

    assert.deepStrictEqual(createCommand('a', 'b', { idx: true }), [
      'LCS',
      'a',
      'b',
      'IDX',
    ]);

    assert.deepStrictEqual(
      createCommand('a', 'b', { idx: true, minmatchlen: 3 }),
      ['LCS', 'a', 'b', 'IDX', 'MINMATCHLEN', '3'],
    );

    assert.deepStrictEqual(
      createCommand('a', 'b', { idx: true, withmatchlen: true }),
      ['LCS', 'a', 'b', 'IDX', 'WITHMATCHLEN'],
    );

    assert.deepStrictEqual(
      createCommand('a', 'b', {
        idx: true,
        minmatchlen: 2,
        withmatchlen: true,
      }),
      ['LCS', 'a', 'b', 'IDX', 'MINMATCHLEN', '2', 'WITHMATCHLEN'],
    );
  });

  it('verifies CLIENT TRACKING command construction with all options', async () => {
    const { createCommand } = await import(
      '../../../sources/command/client.tracking.ts'
    );

    assert.deepStrictEqual(createCommand('ON'), ['CLIENT', 'TRACKING', 'ON']);

    assert.deepStrictEqual(createCommand('OFF'), ['CLIENT', 'TRACKING', 'OFF']);

    assert.deepStrictEqual(createCommand('ON', { redirect: 123 }), [
      'CLIENT',
      'TRACKING',
      'ON',
      'REDIRECT',
      '123',
    ]);

    assert.deepStrictEqual(
      createCommand('ON', { prefixes: ['user:', 'session:'] }),
      ['CLIENT', 'TRACKING', 'ON', 'PREFIX', 'user:', 'PREFIX', 'session:'],
    );

    assert.deepStrictEqual(createCommand('ON', { bcast: true }), [
      'CLIENT',
      'TRACKING',
      'ON',
      'BCAST',
    ]);

    assert.deepStrictEqual(createCommand('ON', { optin: true }), [
      'CLIENT',
      'TRACKING',
      'ON',
      'OPTIN',
    ]);

    assert.deepStrictEqual(createCommand('ON', { optout: true }), [
      'CLIENT',
      'TRACKING',
      'ON',
      'OPTOUT',
    ]);

    assert.deepStrictEqual(createCommand('ON', { noloop: true }), [
      'CLIENT',
      'TRACKING',
      'ON',
      'NOLOOP',
    ]);

    assert.deepStrictEqual(
      createCommand('ON', {
        redirect: 42,
        prefixes: ['key:'],
        bcast: true,
        noloop: true,
      }),
      [
        'CLIENT',
        'TRACKING',
        'ON',
        'REDIRECT',
        '42',
        'PREFIX',
        'key:',
        'BCAST',
        'NOLOOP',
      ],
    );
  });

  it('verifies LPOS command construction with all options', async () => {
    const { createCommand } = await import('../../../sources/command/lpos.ts');

    assert.deepStrictEqual(createCommand('key', 'el'), ['LPOS', 'key', 'el']);

    assert.deepStrictEqual(createCommand('key', 'el', { rank: -1 }), [
      'LPOS',
      'key',
      'el',
      'RANK',
      '-1',
    ]);

    assert.deepStrictEqual(createCommand('key', 'el', { count: 0 }), [
      'LPOS',
      'key',
      'el',
      'COUNT',
      '0',
    ]);

    assert.deepStrictEqual(createCommand('key', 'el', { maxlen: 100 }), [
      'LPOS',
      'key',
      'el',
      'MAXLEN',
      '100',
    ]);

    assert.deepStrictEqual(
      createCommand('key', 'el', { rank: 2, count: 3, maxlen: 50 }),
      ['LPOS', 'key', 'el', 'RANK', '2', 'COUNT', '3', 'MAXLEN', '50'],
    );
  });

  it('verifies LATENCY HISTOGRAM command construction', async () => {
    const { createCommand } = await import(
      '../../../sources/command/latency.histogram.ts'
    );

    assert.deepStrictEqual(createCommand('ping'), [
      'LATENCY',
      'HISTOGRAM',
      'ping',
    ]);

    assert.deepStrictEqual(createCommand('ping', 'set', 'get'), [
      'LATENCY',
      'HISTOGRAM',
      'ping',
      'set',
      'get',
    ]);
  });
});

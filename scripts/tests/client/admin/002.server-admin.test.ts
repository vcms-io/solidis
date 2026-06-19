/**
 * Server administration, memory introspection, slowlog, object introspection,
 * latency diagnostics, and deprecated string commands.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { RespError } from '../../../../sources/index.ts';
import {
  closeClient,
  createClient,
  createKeyspace,
  delay,
  detectServerCapabilities,
} from '../../utils/index.ts';

import type { FeaturedClient, ServerCapabilities } from '../../utils/index.ts';

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

    if (usage === null) {
      assert.fail('MEMORY USAGE must return a byte count for an existing key');
    }

    assert.ok(usage > 0, `expected positive MEMORY USAGE, got ${usage}`);

    const usageWithSamples = await client.memoryUsage(key, 0);

    assert.strictEqual(usageWithSamples, usage);
  });

  it('returns null for MEMORY USAGE of a non-existent key', async () => {
    const result = await client.memoryUsage(keyspace.key('no-such-key'));

    assert.strictEqual(result, null);
  });

  it('returns structured data from MEMORY STATS', async () => {
    const stats = await client.memoryStats();

    assert.ok(
      stats.total.allocated > 0,
      `expected positive memory allocation, got ${stats.total.allocated}`,
    );
    assert.strictEqual(
      typeof stats.keys.count,
      'number',
      'MEMORY STATS keys.count must be a number',
    );
    assert.strictEqual(
      Number.isFinite(stats.keys.count),
      true,
      `expected finite key count, got ${stats.keys.count}`,
    );
  });

  it('runs MEMORY DOCTOR without error', async () => {
    const result = (await client.memoryDoctor()).trimEnd();

    if (result.startsWith('Sam, I detected')) {
      assert.ok(
        result.includes('memory implants'),
        `MEMORY DOCTOR issue report must include 'memory implants' but got: ${result.slice(0, 80)}`,
      );
    } else if (result.startsWith("Hi Sam, I can't find")) {
      assert.strictEqual(
        result,
        "Hi Sam, I can't find any memory issue in your instance. I can only account for what occurs on this base.",
      );
    } else if (result.startsWith('Hi Sam, this instance is empty')) {
      assert.ok(
        result.includes('leave for your mission on Earth'),
        `MEMORY DOCTOR empty-instance message must include the known prose but got: ${result.slice(0, 80)}`,
      );
    } else {
      assert.fail(
        `MEMORY DOCTOR returned an unrecognized response: ${result.slice(0, 80)}`,
      );
    }
  });

  it('returns allocator stats with MEMORY MALLOC-STATS', async () => {
    const stats = await client.memoryMallocStats();

    assert.ok(
      stats.startsWith('___ Begin jemalloc statistics ___'),
      `MEMORY MALLOC-STATS must start with jemalloc header but got: ${stats.slice(0, 40)}`,
    );
  });

  it('purges memory with MEMORY PURGE', async () => {
    assert.strictEqual(await client.memoryPurge(), 'OK');
  });

  it('reads the slowlog with SLOWLOG GET', async () => {
    const entries = await client.slowlogGet(10);

    for (const entry of entries) {
      assert.strictEqual(typeof entry.id, 'number');
      assert.strictEqual(typeof entry.timestamp, 'number');
      assert.strictEqual(typeof entry.duration, 'number');
    }
  });

  it('parses slowlog entries with structured fields', async () => {
    await client.slowlogReset();
    await client.configSet('slowlog-log-slower-than', '0');
    await client.ping();
    await client.configSet('slowlog-log-slower-than', '10000');

    const entries = await client.slowlogGet(5);

    assert.ok(
      entries.length >= 1,
      'slowlog must contain at least one entry after PING',
    );

    const entry = entries[0];

    assert.deepStrictEqual(entry.commandArguments, ['PING']);
    assert.strictEqual(entry.clientName, 'solidis');
  });

  it('reports slowlog length with SLOWLOG LEN', async () => {
    await client.slowlogReset();
    await client.configSet('slowlog-log-slower-than', '0');
    await client.ping();
    await client.configSet('slowlog-log-slower-than', '10000');

    const length = await client.slowlogLen();
    const entries = await client.slowlogGet(length);
    const pingEntries = entries.filter(
      (entry) => entry.commandArguments[0] === 'PING',
    );

    assert.strictEqual(pingEntries.length, 1);
    assert.strictEqual(length, entries.length);
  });

  it('resets the slowlog with SLOWLOG RESET', async () => {
    assert.strictEqual(await client.slowlogReset(), 'OK');
  });

  it('reports reference count with OBJECT REFCOUNT', async () => {
    const key = keyspace.key('object-refcount');

    await client.set(key, 'value');

    const refcount = await client.objectRefcount(key);

    assert.strictEqual(refcount, 1);
  });

  it('reports idle time with OBJECT IDLETIME', async () => {
    const key = keyspace.key('object-idletime');

    await client.set(key, 'value');

    const idle = await client.objectIdletime(key);

    assert.strictEqual(idle, 0);
  });

  it('returns null for OBJECT REFCOUNT of missing key', async () => {
    const result = await client.objectRefcount(keyspace.key('missing'));

    assert.strictEqual(result, null);
  });

  it('returns an array from LATENCY LATEST', async () => {
    await client.latencyReset();

    const latest = await client.latencyLatest();

    assert.deepStrictEqual(latest, []);
  });

  it('resets latency history with LATENCY RESET', async () => {
    await client.latencyReset();

    const result = await client.latencyReset();

    assert.strictEqual(result, 0);
  });

  it('resets statistics with CONFIG RESETSTAT', async () => {
    assert.strictEqual(await client.configResetstat(), 'OK');
  });

  it('returns a timestamp from LASTSAVE', async () => {
    const timestamp = await client.lastsave();
    const nowSeconds = Math.floor(Date.now() / 1000);

    assert.ok(
      timestamp <= nowSeconds,
      `LASTSAVE timestamp ${timestamp} is in the future (now: ${nowSeconds})`,
    );
    assert.ok(
      timestamp >= nowSeconds - 3600,
      `LASTSAVE timestamp ${timestamp} is more than one hour ago (now: ${nowSeconds})`,
    );
  });

  it('triggers a background save with BGSAVE', async () => {
    const result = await client.bgsave().catch((error: Error) => error.message);

    assert.strictEqual(
      result,
      '[BGSAVE] Invalid reply: Background saving started',
    );
  });

  it('triggers a scheduled background save with BGSAVE SCHEDULE', async () => {
    const result = await client
      .bgsave(true)
      .catch((error: Error) => error.message);

    const expectedMessages = [
      '[BGSAVE SCHEDULE] Invalid reply: Background saving scheduled',
      '[BGSAVE SCHEDULE] Invalid reply: RespError: ERR Background save already in progress',
    ];

    assert.ok(
      typeof result === 'string' && expectedMessages.includes(result),
      `BGSAVE SCHEDULE must return a scheduled or already-in-progress reply, got: ${result}`,
    );
  });

  it('triggers AOF rewrite with BGREWRITEAOF', async () => {
    const result = await client
      .bgrewriteaof()
      .catch((error: Error) => error.message);

    assert.strictEqual(
      result,
      '[BGREWRITEAOF] Invalid reply: Background append only file rewriting scheduled',
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

    assert.deepStrictEqual(result, {
      localFsynced: 0,
      replicasAcknowledged: 0,
    });
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

  it('verifies SHUTDOWN command construction without sending', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/shutdown.ts'
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
    const { createCommand } = await import(
      '../../../../sources/command/hello.ts'
    );

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
      '../../../../sources/command/sort.ro.ts'
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
      '../../../../sources/command/function.list.ts'
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
      '../../../../sources/command/function.restore.ts'
    );

    const dump = 'fakebinarydump';

    const dumpBuffer = Buffer.from(dump, 'latin1');

    assert.deepStrictEqual(createCommand(dump), [
      'FUNCTION',
      'RESTORE',
      dumpBuffer,
    ]);

    assert.deepStrictEqual(createCommand(dump, { replace: true }), [
      'FUNCTION',
      'RESTORE',
      dumpBuffer,
      'REPLACE',
    ]);

    assert.deepStrictEqual(createCommand(dump, { flush: true }), [
      'FUNCTION',
      'RESTORE',
      dumpBuffer,
      'FLUSH',
    ]);

    assert.deepStrictEqual(createCommand(dump, { append: true }), [
      'FUNCTION',
      'RESTORE',
      dumpBuffer,
      'APPEND',
    ]);
  });

  it('verifies MIGRATE command construction with all options', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/migrate.ts'
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
      '../../../../sources/command/failover.ts'
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

  it('handles DEBUG SLEEP 0 regardless of server configuration', async () => {
    const [[reply]] = await client.send([['DEBUG', 'SLEEP', '0']]);

    if (reply instanceof RespError) {
      assert.strictEqual(
        reply.message,
        'ERR DEBUG command not allowed. If the enable-debug-command option is set to "local", you can run it from a local connection, otherwise you need to set this option in the configuration file, and then restart the server.',
      );
      return;
    }

    assert.strictEqual(reply, 'OK');
  });

  it('rewrites the config file with CONFIG REWRITE', async () => {
    const result = await client.configRewrite().catch((error: Error) => error);

    if (result instanceof Error) {
      assert.strictEqual(
        result.message,
        '[CONFIG REWRITE] Invalid reply: RespError: ERR The server is running without a config file',
      );
      return;
    }

    assert.strictEqual(result, 'OK');
  });

  it('performs a synchronous save with SAVE', async () => {
    let lastResult: unknown;

    for (let attempt = 0; attempt < 20; attempt++) {
      const result = await client.save().catch((error: Error) => error);
      lastResult = result;

      if (!(result instanceof Error)) {
        assert.strictEqual(result, 'OK');
        return;
      }

      if (result.message.includes('Background save already in progress')) {
        await delay(500);
        continue;
      }

      assert.fail(`SAVE rejected with an unexpected error: ${result.message}`);
    }

    assert.fail(
      `SAVE did not succeed after 20 retries; last result: ${lastResult}`,
    );
  });

  it('reports object access frequency with OBJECT FREQ', async () => {
    const key = keyspace.key('object-freq');

    await client.set(key, 'test');

    const result = await client.objectFreq(key).catch((error: Error) => error);

    if (result instanceof Error) {
      assert.strictEqual(
        result.message,
        `[OBJECT FREQ ${key}] Invalid reply: RespError: ERR An LFU maxmemory policy is not selected, access frequency not tracked. Please note that when switching between policies at runtime LRU and LFU data will take some time to adjust.`,
      );
      return;
    }

    assert.strictEqual(result, 0);
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

    for (const entry of history) {
      assert.strictEqual(typeof entry.timestamp, 'number');
      assert.strictEqual(typeof entry.latency, 'number');
    }
  });

  it('runs LATENCY DOCTOR without error', async () => {
    const result = await client.latencyDoctor();

    if (capabilities.isValkey && capabilities.atLeast(8, 0)) {
      assert.strictEqual(
        result,
        'I\'m sorry, Dave, I can\'t do that. Latency monitoring is disabled in this Valkey instance. You may use "CONFIG SET latency-monitor-threshold <milliseconds>." in order to enable it.\n',
      );
    } else {
      assert.strictEqual(
        result,
        "I'm sorry, Dave, I can't do that. Latency monitoring is disabled in this Redis instance. You may use \"CONFIG SET latency-monitor-threshold <milliseconds>.\" in order to enable it. If we weren't in a deep space mission I'd suggest to take a look at https://redis.io/topics/latency-monitor.\n",
      );
    }
  });

  it('reports missing LATENCY GRAPH samples after LATENCY RESET', async () => {
    await assert.rejects(
      () => client.latencyGraph('command'),
      (error: Error) =>
        error.message ===
        "[LATENCY GRAPH command] Invalid reply: RespError: ERR No samples available for event 'command'",
    );
  });

  it('reads latency histograms with actual command data', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('LATENCY HISTOGRAM requires Redis 7.0+');
      return;
    }

    const before = await client.latencyHistogram('ping');
    const callsBefore = 'ping' in before ? before.ping.calls : 0;

    for (let index = 0; index < 10; index += 1) {
      await client.ping();
    }

    const after = await client.latencyHistogram('ping');

    assert.ok('ping' in after, 'expected a ping histogram entry');
    assert.strictEqual(
      after.ping.calls - callsBefore,
      10,
      `expected exactly 10 additional ping calls, got ${after.ping.calls - callsBefore} (before: ${callsBefore}, after: ${after.ping.calls})`,
    );
  });

  it('kills a running function (none running)', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('FUNCTION KILL requires Redis 7.0+');
      return;
    }

    await assert.rejects(
      () => client.functionKill(),
      (error: Error) =>
        error.message ===
        '[FUNCTION KILL] Invalid reply: RespError: NOTBUSY No scripts in execution right now.',
    );
  });

  it('sets script debug mode', async () => {
    assert.strictEqual(await client.scriptDebug('NO'), 'OK');
  });

  it('verifies AUTH command construction without sending', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/auth.ts'
    );

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
      '../../../../sources/command/replicaof.ts'
    );

    assert.deepStrictEqual(createCommand('127.0.0.1', 6379), [
      'REPLICAOF',
      '127.0.0.1',
      '6379',
    ]);
  });

  it('lists loaded modules with MODULE LIST', async () => {
    const modules = await client.moduleList();

    for (const module of modules) {
      assert.strictEqual(typeof module.name, 'string');
      assert.ok(
        module.name.length > 0,
        'module name must be a non-empty string',
      );
      assert.strictEqual(typeof module.version, 'number');
    }
  });

  it('verifies MODULE LOAD command construction', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/module.load.ts'
    );

    assert.deepStrictEqual(createCommand('/path/to/module.so'), [
      'MODULE',
      'LOAD',
      '/path/to/module.so',
    ]);
  });

  it('verifies MODULE UNLOAD command construction', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/module.unload.ts'
    );

    assert.deepStrictEqual(createCommand('mymodule'), [
      'MODULE',
      'UNLOAD',
      'mymodule',
    ]);
  });

  it('verifies MODULE LOADEX command construction', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/module.loadex.ts'
    );

    assert.deepStrictEqual(createCommand('/path/to/module.so'), [
      'MODULE',
      'LOADEX',
      '/path/to/module.so',
    ]);
  });

  it('resets latency events by name', async () => {
    await client.configSet('latency-monitor-threshold', '1');

    await client.send([
      ['EVAL', 'local x=0 for i=1,5000000 do x=x+1 end return x', '0'],
    ]);

    const reset = await client.latencyReset(['command']);

    await client.configSet('latency-monitor-threshold', '0');

    assert.strictEqual(reset, 1);
  });

  it('returns parsed LATENCY LATEST entries', async () => {
    await client.configSet('latency-monitor-threshold', '1');

    await client.send([
      ['EVAL', 'local x=0 for i=1,5000000 do x=x+1 end return x', '0'],
    ]);

    const result = await client.latencyLatest();

    await client.configSet('latency-monitor-threshold', '0');

    assert.ok(result.length > 0, 'latency events must exist after busy script');

    const commandEvent = result.find((entry) => entry.event === 'command');

    if (commandEvent === undefined) {
      assert.fail('expected a command latency event after busy script');
    }
    if (capabilities.isValkey && capabilities.atLeast(8, 1)) {
      assert.deepStrictEqual(Object.keys(commandEvent).sort(), [
        'count',
        'event',
        'latency',
        'maximumLatency',
        'sum',
        'timestamp',
      ]);
    } else {
      assert.deepStrictEqual(Object.keys(commandEvent).sort(), [
        'event',
        'latency',
        'maximumLatency',
        'timestamp',
      ]);
    }
    assert.ok(commandEvent.timestamp > 0, 'latency timestamp must be positive');
    assert.ok(commandEvent.latency > 0, 'latency must be positive');
    assert.ok(
      commandEvent.maximumLatency >= commandEvent.latency,
      'maximumLatency must be >= latency',
    );
  });

  it('returns parsed LATENCY HISTORY entries', async () => {
    await client.configSet('latency-monitor-threshold', '1');

    await client.send([
      ['EVAL', 'local x=0 for i=1,5000000 do x=x+1 end return x', '0'],
    ]);

    const result = await client.latencyHistory('command');

    await client.configSet('latency-monitor-threshold', '0');

    assert.ok(
      result.length > 0,
      'latency history must exist after busy script',
    );
    assert.deepStrictEqual(Object.keys(result[0]).sort(), [
      'latency',
      'timestamp',
    ]);
    assert.ok(
      result[0].timestamp > 0,
      'latency history timestamp must be positive',
    );
    assert.ok(
      result[0].latency > 0,
      'latency history latency must be positive',
    );
  });

  it('verifies SORT command construction with all options', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/sort.ts'
    );

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
      '../../../../sources/command/restore.ts'
    );

    const dumpBuffer = Buffer.from('dump', 'latin1');

    assert.deepStrictEqual(createCommand('key', 0, 'dump'), [
      'RESTORE',
      'key',
      '0',
      dumpBuffer,
    ]);

    assert.deepStrictEqual(createCommand('key', 0, 'dump', { replace: true }), [
      'RESTORE',
      'key',
      '0',
      dumpBuffer,
      'REPLACE',
    ]);

    assert.deepStrictEqual(createCommand('key', 0, 'dump', { absttl: true }), [
      'RESTORE',
      'key',
      '0',
      dumpBuffer,
      'ABSTTL',
    ]);

    assert.deepStrictEqual(createCommand('key', 0, 'dump', { idletime: 100 }), [
      'RESTORE',
      'key',
      '0',
      dumpBuffer,
      'IDLETIME',
      '100',
    ]);

    assert.deepStrictEqual(createCommand('key', 0, 'dump', { freq: 42 }), [
      'RESTORE',
      'key',
      '0',
      dumpBuffer,
      'FREQ',
      '42',
    ]);

    assert.deepStrictEqual(
      createCommand('key', 0, 'dump', {
        replace: true,
        absttl: true,
        idletime: 50,
        freq: 10,
      }),
      [
        'RESTORE',
        'key',
        '0',
        dumpBuffer,
        'REPLACE',
        'ABSTTL',
        'IDLETIME',
        '50',
        'FREQ',
        '10',
      ],
    );
  });

  it('verifies GETEX command construction with all TTL modes', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/getex.ts'
    );

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
    const { createCommand } = await import(
      '../../../../sources/command/lcs.ts'
    );

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
      '../../../../sources/command/client.tracking.ts'
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
    const { createCommand } = await import(
      '../../../../sources/command/lpos.ts'
    );

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
      '../../../../sources/command/latency.histogram.ts'
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

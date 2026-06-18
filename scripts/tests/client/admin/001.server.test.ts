/**
 * Server and connection introspection commands that do not mutate user data:
 * PING/ECHO/TIME, INFO, CONFIG GET/SET, CLIENT ID/SETNAME/GETNAME, DBSIZE,
 * SELECT, SWAPDB, LOLWUT, ROLE, and WAIT.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
} from '../../utils/index.ts';

import type { FeaturedClient, ServerCapabilities } from '../../utils/index.ts';

describe('server', () => {
  let client: FeaturedClient;
  let capabilities: ServerCapabilities;
  const keyspace = createKeyspace('server');

  before(async () => {
    client = await createClient();
    capabilities = await detectServerCapabilities(client);
  });

  after(async () => {
    await closeClient(client);
  });

  it('responds to PING with and without a payload', async () => {
    assert.strictEqual(await client.ping(), 'PONG');
    assert.strictEqual(await client.ping('custom'), 'custom');
  });

  it('echoes a payload', async () => {
    assert.strictEqual(await client.echo('mirror'), 'mirror');
  });

  it('returns a numeric [seconds, microseconds] pair', async () => {
    const beforeSeconds = Math.floor(Date.now() / 1000);
    const [seconds, microseconds] = await client.time();
    const afterSeconds = Math.floor(Date.now() / 1000);

    assert.ok(
      seconds >= beforeSeconds && seconds <= afterSeconds,
      `TIME seconds ${seconds} outside local clock range ${beforeSeconds}..${afterSeconds}`,
    );
    assert.ok(
      microseconds >= 0 && microseconds < 1_000_000,
      `TIME microseconds ${microseconds} outside valid range 0..999999`,
    );
  });

  it('parses INFO into a record', async () => {
    const info = await client.info('server');

    if (capabilities.isValkey) {
      assert.strictEqual(info.server_name, 'valkey');
      assert.match(info.valkey_version ?? '', /^\d+\.\d+\.\d+$/);
    } else {
      assert.strictEqual(info.redis_mode, 'standalone');
      assert.match(info.redis_version ?? '', /^\d+\.\d+\.\d+$/);
    }
  });

  it('reads and writes runtime configuration', async () => {
    const original = await client.configGet('maxmemory-policy');
    const validPolicies = [
      'noeviction',
      'allkeys-lru',
      'volatile-lru',
      'allkeys-random',
      'volatile-random',
      'volatile-ttl',
      'allkeys-lfu',
      'volatile-lfu',
    ];

    assert.ok(
      validPolicies.includes(original['maxmemory-policy'] ?? ''),
      'maxmemory-policy must be a recognised Redis eviction policy',
    );

    assert.strictEqual(
      await client.configSet('maxmemory-policy', 'allkeys-lru'),
      'OK',
    );
    assert.strictEqual(
      (await client.configGet('maxmemory-policy'))['maxmemory-policy'],
      'allkeys-lru',
    );

    await client.configSet(
      'maxmemory-policy',
      original['maxmemory-policy'] ?? 'noeviction',
    );
  });

  it('reports and assigns the client connection name', async () => {
    const dedicated = await createClient();

    try {
      const clientIdentifier = await dedicated.clientId();

      assert.ok(
        Number.isInteger(clientIdentifier) && clientIdentifier > 0,
        `expected positive integer CLIENT ID, got ${clientIdentifier}`,
      );
      assert.strictEqual(await dedicated.clientSetname('solidis-test'), 'OK');
      assert.strictEqual(await dedicated.clientGetname(), 'solidis-test');
    } finally {
      await closeClient(dedicated);
    }
  });

  it('counts keys in the current database with DBSIZE', async () => {
    const before = await client.dbsize();
    await client.set(keyspace.key('dbsize'), 'value');

    assert.strictEqual(await client.dbsize(), before + 1);
  });

  it('swaps databases', async () => {
    const swapClient = await createClient({ database: 10 });
    const probeClient = await createClient({ database: 11 });
    const key = keyspace.key('swap');

    try {
      await swapClient.flushdb();
      await probeClient.flushdb();
      await swapClient.set(key, 'in-ten');

      assert.strictEqual(await swapClient.swapdb(10, 11), 'OK');
      assert.strictEqual(await swapClient.get(key), null);
      assert.strictEqual(await probeClient.get(key), 'in-ten');

      await swapClient.swapdb(10, 11);
      assert.strictEqual(await swapClient.get(key), 'in-ten');
      assert.strictEqual(await probeClient.get(key), null);
      await swapClient.del(key);
    } finally {
      await closeClient(swapClient);
      await closeClient(probeClient);
    }
  });

  it('renders LOLWUT', async () => {
    const output = await client.lolwut();
    const trimmed = output.trimEnd();

    if (capabilities.isValkey) {
      const version = (await client.info('server')).valkey_version ?? '';
      const brand = capabilities.atLeast(9, 0) ? 'Valkey' : 'Redis';
      const versionFooter = `${brand} ver. ${version}`;

      assert.ok(
        trimmed.endsWith(versionFooter),
        `Valkey ${capabilities.major} LOLWUT must end with '${versionFooter}' but got: ...${trimmed.slice(-80)}`,
      );
    } else {
      const version = (await client.info('server')).redis_version ?? '';
      const versionFooter = `Redis ver. ${version}`;

      if (capabilities.atLeast(7, 0) && capabilities.major === 7) {
        assert.strictEqual(
          trimmed,
          versionFooter,
          `Redis 7 LOLWUT must be exactly '${versionFooter}'`,
        );
      } else {
        assert.ok(
          trimmed.endsWith(versionFooter),
          `LOLWUT must end with '${versionFooter}' but got: ...${trimmed.slice(-80)}`,
        );
        assert.notStrictEqual(
          trimmed,
          versionFooter,
          'LOLWUT with art must include content before the version footer',
        );
      }
    }
  });

  it('reports a structured replication role', async () => {
    const infoReplication = await client.info('replication');
    const expectedOffset = Number.parseInt(
      infoReplication.master_repl_offset,
      10,
    );

    const role = await client.role();

    assert.strictEqual(role.role, 'master');

    if (role.role === 'master') {
      assert.strictEqual(role.replicationOffset, expectedOffset);
      assert.deepStrictEqual(role.slaves, []);
    }
  });

  it('returns immediately from WAIT with zero replicas', async () => {
    assert.strictEqual(await client.wait(0, 100), 0);
  });

  it('constructs REPLCONF with subcommand and arguments', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/replconf.ts'
    );

    assert.deepStrictEqual(createCommand('GETACK', '*'), [
      'REPLCONF',
      'GETACK',
      '*',
    ]);
    assert.deepStrictEqual(createCommand('listening-port', '6380'), [
      'REPLCONF',
      'listening-port',
      '6380',
    ]);
  });

  it('constructs MODULE LOAD with parameters', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/module.load.ts'
    );

    const command = createCommand('/path/to/module.so', ['arg1', 'arg2']);

    assert.deepStrictEqual(command, [
      'MODULE',
      'LOAD',
      '/path/to/module.so',
      'arg1',
      'arg2',
    ]);
  });

  it('constructs MODULE LOAD without parameters', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/module.load.ts'
    );

    assert.deepStrictEqual(createCommand('/path/to/module.so'), [
      'MODULE',
      'LOAD',
      '/path/to/module.so',
    ]);
  });

  it('constructs MODULE LOADEX with config and parameters', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/module.loadex.ts'
    );

    const command = createCommand(
      '/path/to/module.so',
      { maxmemory: '100mb', threads: '4' },
      ['opt1', 'opt2'],
    );

    assert.deepStrictEqual(command, [
      'MODULE',
      'LOADEX',
      '/path/to/module.so',
      'CONFIG',
      'maxmemory',
      '100mb',
      'CONFIG',
      'threads',
      '4',
      'ARGS',
      'opt1',
      'opt2',
    ]);
  });

  it('constructs MODULE LOADEX without config or parameters', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/module.loadex.ts'
    );

    assert.deepStrictEqual(createCommand('/path/to/module.so'), [
      'MODULE',
      'LOADEX',
      '/path/to/module.so',
    ]);
  });

  it('constructs MODULE UNLOAD', async () => {
    const { createCommand } = await import(
      '../../../../sources/command/module.unload.ts'
    );

    assert.deepStrictEqual(createCommand('mymodule'), [
      'MODULE',
      'UNLOAD',
      'mymodule',
    ]);
  });

  it('parses module info with path and arguments', async () => {
    const { tryReplyToModuleInfo } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    const info = tryReplyToModuleInfo([
      'name',
      'ReJSON',
      'ver',
      '20000',
      'path',
      '/usr/lib/redis/modules/rejson.so',
      'args',
      ['arg1', 'arg2'],
    ]);

    assert.strictEqual(info.name, 'ReJSON');
    assert.strictEqual(info.version, 20000);
    assert.strictEqual(info.path, '/usr/lib/redis/modules/rejson.so');
    assert.deepStrictEqual(info.arguments, ['arg1', 'arg2']);
    assert.deepStrictEqual(Object.keys(info).sort(), [
      'arguments',
      'name',
      'path',
      'version',
    ]);
  });

  it('parses recursive string record from reply', async () => {
    const { tryReplyToStringRecordRecursively } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    const result = tryReplyToStringRecordRecursively([
      'name',
      'get',
      'summary',
      'Get the value of a key',
      'arguments',
      ['key', 'string'],
    ]);

    assert.strictEqual(result.name, 'get');
    assert.strictEqual(result.summary, 'Get the value of a key');
    assert.deepStrictEqual(result.arguments, { key: 'string' });
    assert.deepStrictEqual(Object.keys(result).sort(), [
      'arguments',
      'name',
      'summary',
    ]);
  });
});

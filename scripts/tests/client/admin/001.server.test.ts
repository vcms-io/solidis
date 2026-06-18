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
} from '../../utils/index.ts';

import type { FeaturedClient } from '../../utils/index.ts';

describe('server', () => {
  let client: FeaturedClient;
  const keyspace = createKeyspace('server');

  before(async () => {
    client = await createClient();
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
    const [seconds, microseconds] = await client.time();

    assert.strictEqual(typeof seconds, 'number');
    assert.strictEqual(typeof microseconds, 'number');
    assert.ok(seconds > 1_600_000_000);
    assert.ok(microseconds >= 0);
    assert.ok(microseconds < 1_000_000);
  });

  it('parses INFO into a record', async () => {
    const info = await client.info('server');

    assert.match(info.redis_version ?? info.valkey_version ?? '', /^\d+\.\d+/);
    assert.strictEqual(typeof (info.redis_mode ?? info.server_name), 'string');
  });

  it('reads and writes runtime configuration', async () => {
    const original = await client.configGet('maxmemory-policy');

    assert.ok((original['maxmemory-policy'] ?? '').length > 0);

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
      assert.ok((await dedicated.clientId()) > 0);
      assert.strictEqual(await dedicated.clientSetname('solidis-test'), 'OK');
      assert.strictEqual(await dedicated.clientGetname(), 'solidis-test');
    } finally {
      await closeClient(dedicated);
    }
  });

  it('counts keys in the current database with DBSIZE', async () => {
    await client.set(keyspace.key('dbsize'), 'value');

    assert.ok((await client.dbsize()) > 0);
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
      assert.strictEqual(await probeClient.get(key), 'in-ten');

      await swapClient.swapdb(10, 11);
      await swapClient.del(key);
    } finally {
      await closeClient(swapClient);
      await closeClient(probeClient);
    }
  });

  it('renders LOLWUT', async () => {
    assert.ok((await client.lolwut()).length > 0);
  });

  it('reports a structured replication role', async () => {
    const role = await client.role();

    assert.strictEqual(role.role, 'master');

    if (role.role === 'master') {
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
  });
});

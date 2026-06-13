/**
 * Redis Functions (7.0+): FUNCTION LOAD/LIST/DELETE/DUMP/RESTORE/FLUSH/STATS,
 * and FCALL / FCALL_RO for invoking registered functions.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
} from '../utils/index.ts';

import type { FeaturedClient, ServerCapabilities } from '../utils/index.ts';

const libraryCode = `#!lua name=solidistest
redis.register_function('solidistest_echo', function(keys, args)
  return args[1]
end)
redis.register_function('solidistest_set', function(keys, args)
  return redis.call('SET', keys[1], args[1])
end)
redis.register_function{
  function_name='solidistest_get',
  callback=function(keys, args)
    return redis.call('GET', keys[1])
  end,
  flags={'no-writes'}
}
`;

describe('function', () => {
  let client: FeaturedClient;
  let capabilities: ServerCapabilities;
  let supported = false;
  const keyspace = createKeyspace('function');

  before(async () => {
    client = await createClient();
    capabilities = await detectServerCapabilities(client);
    supported = capabilities.atLeast(7, 0);

    if (supported) {
      try {
        await client.functionDelete('solidistest');
      } catch {
        /* library may not exist yet */
      }
    }
  });

  after(async () => {
    if (supported) {
      try {
        await client.functionDelete('solidistest');
      } catch {
        /* cleanup */
      }
    }
    await closeClient(client);
  });

  it('loads a library with FUNCTION LOAD', async (context) => {
    if (!supported) {
      context.skip('Functions require Redis 7.0+');
      return;
    }

    const name = await client.functionLoad(libraryCode);

    assert.strictEqual(name, 'solidistest');
  });

  it('lists loaded libraries with FUNCTION LIST', async (context) => {
    if (!supported) {
      context.skip('Functions require Redis 7.0+');
      return;
    }

    await client.functionLoad(libraryCode, true);

    const list = await client.functionList();

    assert.ok(Array.isArray(list));

    const library = list.find((item) => item.libraryName === 'solidistest');

    assert.notStrictEqual(library, undefined);

    if (library === undefined) {
      return;
    }

    assert.strictEqual(library.engine, 'LUA');
    assert.ok(library.functions.length >= 2);
    assert.ok(
      library.functions.some((entry) => entry.name === 'solidistest_echo'),
    );
  });

  it('filters FUNCTION LIST by library name pattern', async (context) => {
    if (!supported) {
      context.skip('Functions require Redis 7.0+');
      return;
    }

    await client.functionLoad(libraryCode, true);

    const list = await client.functionList({
      libraryNamePattern: 'solidistest',
    });

    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].libraryName, 'solidistest');
  });

  it('invokes a function with FCALL', async (context) => {
    if (!supported) {
      context.skip('Functions require Redis 7.0+');
      return;
    }

    await client.functionLoad(libraryCode, true);

    const result = await client.fcall('solidistest_echo', [], ['hello']);

    assert.strictEqual(`${result}`, 'hello');
  });

  it('mutates state through FCALL', async (context) => {
    if (!supported) {
      context.skip('Functions require Redis 7.0+');
      return;
    }

    await client.functionLoad(libraryCode, true);

    const key = keyspace.key('fcall-set');

    await client.fcall('solidistest_set', [key], ['stored']);

    assert.strictEqual(await client.get(key), 'stored');
  });

  it('reads state through FCALL_RO', async (context) => {
    if (!supported) {
      context.skip('Functions require Redis 7.0+');
      return;
    }

    await client.functionLoad(libraryCode, true);

    const key = keyspace.key('fcall-ro');

    await client.set(key, 'read-only');

    const result = await client.fcallRo('solidistest_get', [key], []);

    assert.strictEqual(`${result}`, 'read-only');
  });

  it('reports function stats with FUNCTION STATS', async (context) => {
    if (!supported) {
      context.skip('Functions require Redis 7.0+');
      return;
    }

    await client.functionLoad(libraryCode, true);

    const stats = await client.functionStats();

    assert.strictEqual(stats.runningScript, null);
    assert.ok(Array.isArray(stats.engines));
    assert.ok(stats.engines.length > 0);

    const luaEngine = stats.engines.find((engine) => engine.name === 'LUA');

    assert.notStrictEqual(luaEngine, undefined);

    if (luaEngine === undefined) {
      return;
    }

    assert.ok(luaEngine.libraries >= 1);
    assert.ok(luaEngine.functions >= 2);
  });

  it('dumps and restores function state', async (context) => {
    if (!supported) {
      context.skip('Functions require Redis 7.0+');
      return;
    }

    await client.functionLoad(libraryCode, true);

    const dump = await client.functionDump();

    assert.strictEqual(typeof dump, 'string');
    assert.ok(dump.length > 0);

    await client.functionFlush();

    const emptyList = await client.functionList();

    assert.strictEqual(
      emptyList.find((item) => item.libraryName === 'solidistest'),
      undefined,
    );

    await client.functionRestore(dump, { replace: true });

    const restored = await client.functionList();

    assert.ok(restored.some((item) => item.libraryName === 'solidistest'));
  });

  it('restores functions with FLUSH policy', async (context) => {
    if (!supported) {
      context.skip('Functions require Redis 7.0+');
      return;
    }

    await client.functionLoad(libraryCode, true);

    const dump = await client.functionDump();

    await client.functionRestore(dump, { flush: true });

    const list = await client.functionList();

    assert.ok(list.some((item) => item.libraryName === 'solidistest'));
  });

  it('deletes a library with FUNCTION DELETE', async (context) => {
    if (!supported) {
      context.skip('Functions require Redis 7.0+');
      return;
    }

    await client.functionLoad(libraryCode, true);

    assert.strictEqual(await client.functionDelete('solidistest'), 'OK');

    const list = await client.functionList();

    assert.strictEqual(
      list.find((item) => item.libraryName === 'solidistest'),
      undefined,
    );
  });

  it('flushes all functions with FUNCTION FLUSH', async (context) => {
    if (!supported) {
      context.skip('Functions require Redis 7.0+');
      return;
    }

    await client.functionLoad(libraryCode, true);

    assert.strictEqual(await client.functionFlush(), 'OK');

    const list = await client.functionList();

    assert.strictEqual(
      list.find((item) => item.libraryName === 'solidistest'),
      undefined,
    );
  });

  it('flushes functions asynchronously with FUNCTION FLUSH ASYNC', async (context) => {
    if (!supported) {
      context.skip('Functions require Redis 7.0+');
      return;
    }

    await client.functionLoad(libraryCode, true);

    assert.strictEqual(await client.functionFlush(true), 'OK');
  });

  it('returns function stats with engines and null running_script', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const stats = await client.functionStats();

    assert.ok(stats !== null && typeof stats === 'object');
    assert.strictEqual(stats.runningScript, null);
    assert.ok(Array.isArray(stats.engines));
    assert.ok(stats.engines.length >= 1);

    const engine = stats.engines[0];

    assert.strictEqual(typeof engine.name, 'string');
    assert.strictEqual(typeof engine.libraries, 'number');
    assert.strictEqual(typeof engine.functions, 'number');
  });
});

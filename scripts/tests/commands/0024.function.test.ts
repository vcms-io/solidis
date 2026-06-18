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

const expectedSolidistestFunctions = [
  { name: 'solidistest_echo', description: null, flags: [] },
  { name: 'solidistest_get', description: null, flags: ['no-writes'] },
  { name: 'solidistest_set', description: null, flags: [] },
];

function sortFunctionsByName(
  functions: Array<{
    name: string;
    description: string | null;
    flags: string[];
  }>,
): Array<{ name: string; description: string | null; flags: string[] }> {
  return [...functions].sort((a, b) => a.name.localeCompare(b.name));
}

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

    const library = list.find((item) => item.libraryName === 'solidistest');

    if (library === undefined) {
      assert.fail('expected to find solidistest library in FUNCTION LIST');
    }
    assert.strictEqual(library.libraryName, 'solidistest');
    assert.strictEqual(library.engine, 'LUA');
    assert.deepStrictEqual(
      sortFunctionsByName(library.functions),
      expectedSolidistestFunctions,
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
    assert.strictEqual(list[0].engine, 'LUA');
    assert.deepStrictEqual(
      sortFunctionsByName(list[0].functions),
      expectedSolidistestFunctions,
    );
  });

  it('invokes a function with FCALL', async (context) => {
    if (!supported) {
      context.skip('Functions require Redis 7.0+');
      return;
    }

    await client.functionLoad(libraryCode, true);

    const result = await client.fcall('solidistest_echo', [], ['hello']);

    assert.deepStrictEqual(result, Buffer.from('hello'));
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

    assert.deepStrictEqual(result, Buffer.from('read-only'));
  });

  it('reports function stats with FUNCTION STATS', async (context) => {
    if (!supported) {
      context.skip('Functions require Redis 7.0+');
      return;
    }

    await client.functionLoad(libraryCode, true);

    const stats = await client.functionStats();

    assert.strictEqual(stats.runningScript, null);
    assert.deepStrictEqual(
      stats.engines.find((engine) => engine.name === 'LUA'),
      { name: 'LUA', libraries: 1, functions: 3 },
    );
  });

  it('dumps and restores function state', async (context) => {
    if (!supported) {
      context.skip('Functions require Redis 7.0+');
      return;
    }

    await client.functionLoad(libraryCode, true);

    const dump = await client.functionDump();

    await client.functionFlush();

    const emptyList = await client.functionList();

    assert.deepStrictEqual(emptyList, []);

    await client.functionRestore(dump, { replace: true });

    const restored = await client.functionList();

    assert.strictEqual(restored.length, 1);
    assert.strictEqual(restored[0].libraryName, 'solidistest');
    assert.strictEqual(restored[0].engine, 'LUA');
    assert.deepStrictEqual(
      sortFunctionsByName(restored[0].functions),
      expectedSolidistestFunctions,
    );
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

    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].libraryName, 'solidistest');
    assert.strictEqual(list[0].engine, 'LUA');
    assert.deepStrictEqual(
      sortFunctionsByName(list[0].functions),
      expectedSolidistestFunctions,
    );
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

    const list = await client.functionList();

    assert.deepStrictEqual(list, []);
  });

  it('returns function stats with engines and null running_script', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    await client.functionLoad(libraryCode, true);

    const stats = await client.functionStats();

    assert.strictEqual(stats.runningScript, null);
    assert.deepStrictEqual(
      stats.engines.find((engine) => engine.name === 'LUA'),
      { name: 'LUA', libraries: 1, functions: 3 },
    );
  });
});

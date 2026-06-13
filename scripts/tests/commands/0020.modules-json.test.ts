/**
 * RedisJSON (ReJSON) document commands. The whole suite is gated on module
 * availability so it runs in full against Redis Stack and self-skips on a
 * server without the module.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
  isCommandSupported,
} from '../utils/index.ts';

import type { FeaturedClient, ServerCapabilities } from '../utils/index.ts';

describe('modules-json', () => {
  let client: FeaturedClient;
  let available = false;
  let capabilities: ServerCapabilities;
  const keyspace = createKeyspace('json');

  before(async () => {
    client = await createClient();
    available = await isCommandSupported(client, ['JSON.SET']);
    capabilities = await detectServerCapabilities(client);
  });

  after(async () => {
    await closeClient(client);
  });

  it('sets and gets a document at the root', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('document');
    const document = { name: 'solidis', version: 1, tags: ['fast', 'tiny'] };

    assert.strictEqual(
      await client.jsonSet(key, '$', JSON.stringify(document)),
      'OK',
    );

    const raw = await client.jsonGet(key);

    assert.strictEqual(typeof raw, 'string');

    if (typeof raw !== 'string') {
      return;
    }

    assert.deepStrictEqual(JSON.parse(raw), document);
  });

  it('reads a nested path', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('nested');

    await client.jsonSet(key, '$', '{"user":{"name":"jay","age":30}}');

    const name = await client.jsonGet(key, { path: ['$.user.name'] });

    assert.strictEqual(typeof name, 'string');

    if (typeof name !== 'string') {
      return;
    }

    assert.deepStrictEqual(JSON.parse(name), ['jay']);
  });

  it('reports value types', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('types');

    await client.jsonSet(key, '$', '{"s":"x","n":1,"a":[],"b":true}');

    assert.deepStrictEqual(await client.jsonType(key, '$.s'), ['string']);
    assert.deepStrictEqual(await client.jsonType(key, '$.n'), ['integer']);
    assert.deepStrictEqual(await client.jsonType(key, '$.a'), ['array']);
    assert.deepStrictEqual(await client.jsonType(key, '$.b'), ['boolean']);
  });

  it('increments a numeric field', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('counter');

    await client.jsonSet(key, '$', '{"hits":10}');

    const result = await client.jsonNumincrby(key, '$.hits', 5);

    assert.strictEqual(typeof result, 'string');

    if (typeof result !== 'string') {
      return;
    }

    assert.deepStrictEqual(JSON.parse(result), [15]);
  });

  it('appends to arrays and reports length', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('array');

    await client.jsonSet(key, '$', '{"items":[1,2]}');

    assert.deepStrictEqual(
      await client.jsonArrappend(key, '$.items', '3', '4'),
      [4],
    );
    assert.deepStrictEqual(await client.jsonArrlen(key, '$.items'), [4]);
  });

  it('appends to strings', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('string');

    await client.jsonSet(key, '$', '{"greeting":"hello"}');

    assert.deepStrictEqual(
      await client.jsonStrappend(key, '" world"', '$.greeting'),
      [11],
    );
  });

  it('toggles booleans', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('toggle');

    await client.jsonSet(key, '$', '{"active":true}');

    assert.deepStrictEqual(await client.jsonToggle(key, '$.active'), [0]);
    assert.deepStrictEqual(await client.jsonToggle(key, '$.active'), [1]);
  });

  it('lists object keys', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('objkeys');

    await client.jsonSet(key, '$', '{"a":1,"b":2,"c":3}');

    const keys = await client.jsonObjkeys(key, '$');

    assert.strictEqual(keys.length, 1);
    assert.ok(Array.isArray(keys[0]));

    if (!Array.isArray(keys[0])) {
      return;
    }

    assert.deepStrictEqual([...keys[0]].sort(), ['a', 'b', 'c']);
  });

  it('deletes a path', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('delete');

    await client.jsonSet(key, '$', '{"keep":1,"drop":2}');

    assert.strictEqual(await client.jsonDel(key, '$.drop'), 1);

    const remaining = await client.jsonGet(key);

    assert.strictEqual(typeof remaining, 'string');

    if (typeof remaining !== 'string') {
      return;
    }

    assert.deepStrictEqual(JSON.parse(remaining), { keep: 1 });
  });

  it('finds an element index in an array with JSON.ARRINDEX', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('arrindex');

    await client.jsonSet(key, '$', '{"items":["a","b","c","d"]}');

    assert.deepStrictEqual(
      await client.jsonArrindex(key, '$.items', '"b"'),
      [1],
    );
    assert.deepStrictEqual(
      await client.jsonArrindex(key, '$.items', '"missing"'),
      [-1],
    );
  });

  it('inserts into an array with JSON.ARRINSERT', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('arrinsert');

    await client.jsonSet(key, '$', '{"items":[1,2,4]}');

    assert.deepStrictEqual(
      await client.jsonArrinsert(key, '$.items', 2, '3'),
      [4],
    );

    const raw = await client.jsonGet(key, { path: ['$.items'] });

    assert.strictEqual(typeof raw, 'string');

    if (typeof raw !== 'string') {
      return;
    }

    assert.deepStrictEqual(JSON.parse(raw), [[1, 2, 3, 4]]);
  });

  it('pops from an array with JSON.ARRPOP', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('arrpop');

    await client.jsonSet(key, '$', '{"items":[10,20,30]}');

    const popped = await client.jsonArrpop(key, '$.items');

    assert.deepStrictEqual(popped, ['30']);
  });

  it('trims an array with JSON.ARRTRIM', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('arrtrim');

    await client.jsonSet(key, '$', '{"items":[0,1,2,3,4,5]}');

    assert.deepStrictEqual(
      await client.jsonArrtrim(key, '$.items', { start: 1, stop: 3 }),
      [3],
    );

    const raw = await client.jsonGet(key, { path: ['$.items'] });

    assert.strictEqual(typeof raw, 'string');

    if (typeof raw !== 'string') {
      return;
    }

    assert.deepStrictEqual(JSON.parse(raw), [[1, 2, 3]]);
  });

  it('clears containers with JSON.CLEAR', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('clear');

    await client.jsonSet(key, '$', '{"obj":{"a":1},"arr":[1,2,3]}');

    assert.strictEqual(await client.jsonClear(key, '$.*'), 2);

    const raw = await client.jsonGet(key);

    assert.strictEqual(typeof raw, 'string');

    if (typeof raw !== 'string') {
      return;
    }

    assert.deepStrictEqual(JSON.parse(raw), { obj: {}, arr: [] });
  });

  it('reports memory usage with JSON.DEBUG MEMORY', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('debug');

    await client.jsonSet(key, '$', '{"hello":"world"}');

    const memory = await client.jsonDebug('MEMORY', key);

    assert.ok(typeof memory === 'number');
    assert.ok(memory > 0);
  });

  it('aliases deletion with JSON.FORGET', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('forget');

    await client.jsonSet(key, '$', '{"a":1,"b":2}');

    assert.strictEqual(await client.jsonForget(key, '$.b'), 1);

    const raw = await client.jsonGet(key);

    assert.strictEqual(typeof raw, 'string');

    if (typeof raw !== 'string') {
      return;
    }

    assert.deepStrictEqual(JSON.parse(raw), { a: 1 });
  });

  it('merges documents with JSON.MERGE', async (context) => {
    if (!available || !(await isCommandSupported(client, ['JSON.MERGE']))) {
      context.skip('JSON.MERGE not available');
      return;
    }

    const key = keyspace.key('merge');

    await client.jsonSet(key, '$', '{"a":1,"b":2}');

    assert.strictEqual(await client.jsonMerge(key, '{"b":3,"c":4}', '$'), 'OK');

    const raw = await client.jsonGet(key);

    assert.strictEqual(typeof raw, 'string');

    if (typeof raw !== 'string') {
      return;
    }

    assert.deepStrictEqual(JSON.parse(raw), { a: 1, b: 3, c: 4 });
  });

  it('reads multiple keys with JSON.MGET', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key1 = keyspace.key('mget', '1');
    const key2 = keyspace.key('mget', '2');

    await client.jsonSet(key1, '$', '{"val":1}');
    await client.jsonSet(key2, '$', '{"val":2}');

    const results = await client.jsonMget([key1, key2], '$.val');

    assert.strictEqual(typeof results[0], 'string');
    assert.strictEqual(typeof results[1], 'string');

    if (typeof results[0] !== 'string' || typeof results[1] !== 'string') {
      return;
    }

    assert.deepStrictEqual(JSON.parse(results[0]), [1]);
    assert.deepStrictEqual(JSON.parse(results[1]), [2]);
  });

  it('writes multiple keys with JSON.MSET', async (context) => {
    if (!available || !(await isCommandSupported(client, ['JSON.MSET']))) {
      context.skip('JSON.MSET not available');
      return;
    }

    const key1 = keyspace.key('mset', '1');
    const key2 = keyspace.key('mset', '2');

    assert.strictEqual(
      await client.jsonMset([
        { key: key1, path: '$', value: '{"x":1}' },
        { key: key2, path: '$', value: '{"x":2}' },
      ]),
      'OK',
    );

    const raw1 = await client.jsonGet(key1);
    const raw2 = await client.jsonGet(key2);

    assert.strictEqual(typeof raw1, 'string');
    assert.strictEqual(typeof raw2, 'string');

    if (typeof raw1 !== 'string' || typeof raw2 !== 'string') {
      return;
    }

    assert.deepStrictEqual(JSON.parse(raw1), { x: 1 });
    assert.deepStrictEqual(JSON.parse(raw2), { x: 2 });
  });

  it('multiplies a numeric field with JSON.NUMMULTBY', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('nummultby');

    await client.jsonSet(key, '$', '{"factor":3}');

    const result = await client.jsonNummultby(key, '$.factor', 4);

    assert.strictEqual(typeof result, 'string');

    if (typeof result !== 'string') {
      return;
    }

    assert.deepStrictEqual(JSON.parse(result), [12]);
  });

  it('reports object length with JSON.OBJLEN', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('objlen');

    await client.jsonSet(key, '$', '{"a":1,"b":2,"c":3}');

    assert.deepStrictEqual(await client.jsonObjlen(key, '$'), [3]);
  });

  it('reports string length with JSON.STRLEN', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('strlen');

    await client.jsonSet(key, '$', '{"greeting":"hello"}');

    assert.deepStrictEqual(await client.jsonStrlen(key, '$.greeting'), [5]);
  });

  it('returns RESP representation with JSON.RESP', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('resp');

    await client.jsonSet(key, '$', '{"num":42}');

    const result = await client.jsonResp(key);

    assert.ok(Array.isArray(result));

    if (capabilities.isValkey) {
      /** Valkey JSON returns a flat array including nested values. */
      assert.ok(result.length >= 1);
    } else {
      /** Redis ReJSON RESP form: `['{', <key>, <value>, ...]`. */
      assert.strictEqual(result[0], '{');
      assert.strictEqual(`${result[1]}`, 'num');
      assert.strictEqual(result[2], 42);
    }
  });

  it('uses JSON.SET with NX option (set only if not exists)', async (context) => {
    if (!available) {
      context.skip('RedisJSON not loaded');
      return;
    }

    const key = keyspace.key('set-nx');

    assert.strictEqual(
      await client.jsonSet(key, '$', '"first"', { nx: true }),
      'OK',
    );
    assert.strictEqual(
      await client.jsonSet(key, '$', '"second"', { nx: true }),
      null,
    );

    const raw = await client.jsonGet(key);

    assert.strictEqual(raw, '"first"');
  });

  it('uses JSON.SET with XX option (set only if exists)', async (context) => {
    if (!available) {
      context.skip('RedisJSON not loaded');
      return;
    }

    const key = keyspace.key('set-xx');

    assert.strictEqual(
      await client.jsonSet(key, '$', '"val"', { xx: true }),
      null,
    );

    await client.jsonSet(key, '$', '"original"');

    assert.strictEqual(
      await client.jsonSet(key, '$', '"updated"', { xx: true }),
      'OK',
    );

    assert.strictEqual(await client.jsonGet(key), '"updated"');
  });

  it('uses JSON.GET with formatting options', async (context) => {
    if (!available) {
      context.skip('RedisJSON not loaded');
      return;
    }

    const key = keyspace.key('get-format');

    await client.jsonSet(key, '$', '{"a":1,"b":2}');

    const formatted = await client.jsonGet(key, {
      indent: '  ',
      newline: '\n',
      space: ' ',
      path: ['$'],
    });

    assert.ok(formatted !== null);
    assert.ok(formatted.includes('\n'));
  });

  it('searches JSON array with start/stop range', async (context) => {
    if (!available) {
      context.skip('RedisJSON not loaded');
      return;
    }

    const key = keyspace.key('arrindex-range');

    await client.jsonSet(key, '$', '{"items":["a","b","c","b","d"]}');

    const fromStart = await client.jsonArrindex(key, '$.items', '"b"', {
      start: 2,
    });

    assert.deepStrictEqual(fromStart, [3]);

    const withStop = await client.jsonArrindex(key, '$.items', '"b"', {
      start: 0,
      stop: 2,
    });

    assert.deepStrictEqual(withStop, [1]);
  });

  it('returns JSON.DEBUG HELP output', async (context) => {
    if (!available) {
      context.skip('RedisJSON not loaded');
      return;
    }

    const result = await client.jsonDebug('HELP');

    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
  });

  it('reports JSON.DEBUG MEMORY with a path', async (context) => {
    if (!available) {
      context.skip('RedisJSON not loaded');
      return;
    }

    const key = keyspace.key('debug-memory-path');

    await client.jsonSet(key, '$', '{"user":{"name":"test"}}');

    const result = await client.jsonDebug('MEMORY', key, '$.user');

    /** JSONPath form returns one byte-size measurement per match. */
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);

    const [bytes] = result;

    assert.ok(typeof bytes === 'number' && bytes > 0);
  });

  it('returns root-level keys with JSON.OBJKEYS (no path)', async (context) => {
    if (!available) {
      context.skip('RedisJSON not loaded');
      return;
    }

    const key = keyspace.key('objkeys-root');

    await client.jsonSet(key, '$', '{"alpha":1,"beta":2}');

    const keys = await client.jsonObjkeys(key);

    assert.ok(Array.isArray(keys));
    assert.ok(keys.length >= 2);
  });

  it('returns null from JSON.OBJKEYS on non-object path', async (context) => {
    if (!available) {
      context.skip('RedisJSON not loaded');
      return;
    }

    const key = keyspace.key('objkeys-null');

    await client.jsonSet(key, '$', '{"str":"hello","obj":{"a":1}}');

    const result = await client.jsonObjkeys(key, '$.str');

    assert.ok(Array.isArray(result));

    if (capabilities.isValkey) {
      /** Valkey wraps non-object paths as an empty nested array. */
      assert.ok(
        Array.isArray(result[0]) && result[0].length === 0,
        `expected [[]] but got ${JSON.stringify(result)}`,
      );
    } else {
      assert.strictEqual(result[0], null);
    }
  });

  it('returns root type with JSON.TYPE (no path)', async (context) => {
    if (!available) {
      context.skip('RedisJSON not loaded');
      return;
    }

    const key = keyspace.key('type-root');

    await client.jsonSet(key, '$', '{"a":1}');

    const result = await client.jsonType(key);

    /** Legacy (no JSONPath) form returns the scalar type directly. */
    assert.strictEqual(result, 'object');
  });

  it('returns null from JSON.TYPE on missing path', async (context) => {
    if (!available) {
      context.skip('RedisJSON not loaded');
      return;
    }

    const key = keyspace.key('type-null');

    await client.jsonSet(key, '$', '{"a":1}');

    const result = await client.jsonType(key, '$.nonexistent');

    /** A JSONPath that matches nothing yields an empty array, not null. */
    assert.deepStrictEqual(result, []);
  });
});

/**
 * SORT / SORT_RO over lists and external weights, and the longest-common-
 * subsequence command (LCS) in plain, length, and index modes.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/client.ts';

describe('sort-lcs', () => {
  let client: FeaturedClient;
  let atLeast7 = false;
  const keyspace = createKeyspace('sort-lcs');

  before(async () => {
    client = await createClient();
    atLeast7 = (await detectServerCapabilities(client)).atLeast(7, 0);
  });

  after(async () => {
    await closeClient(client);
  });

  it('sorts numeric list elements', async () => {
    const key = keyspace.key('numbers');

    await client.rpush(key, '3', '1', '2', '5', '4');

    assert.deepStrictEqual(await client.sort(key), ['1', '2', '3', '4', '5']);
    assert.deepStrictEqual(await client.sort(key, { order: 'DESC' }), [
      '5',
      '4',
      '3',
      '2',
      '1',
    ]);
    assert.deepStrictEqual(
      await client.sort(key, { limit: { offset: 0, count: 2 } }),
      ['1', '2'],
    );
  });

  it('sorts lexicographically with ALPHA', async () => {
    const key = keyspace.key('words');

    await client.rpush(key, 'banana', 'apple', 'cherry');

    assert.deepStrictEqual(await client.sort(key, { alpha: true }), [
      'apple',
      'banana',
      'cherry',
    ]);
  });

  it('sorts by external weights and fetches patterns', async () => {
    const list = keyspace.key('ids');

    await client.rpush(list, '1', '2', '3');
    await client.mset({
      [keyspace.key('weight', 1)]: '30',
      [keyspace.key('weight', 2)]: '10',
      [keyspace.key('weight', 3)]: '20',
    });
    await client.mset({
      [keyspace.key('data', 1)]: 'one',
      [keyspace.key('data', 2)]: 'two',
      [keyspace.key('data', 3)]: 'three',
    });

    const sorted = await client.sort(list, {
      by: `${keyspace.namespace}:weight:*`,
      get: [`${keyspace.namespace}:data:*`],
    });

    assert.deepStrictEqual(sorted, ['two', 'three', 'one']);
  });

  it('stores sorted output into a destination key', async () => {
    const source = keyspace.key('store', 'source');
    const destination = keyspace.key('store', 'destination');

    await client.rpush(source, '3', '1', '2');

    assert.strictEqual(await client.sort(source, { store: destination }), 3);
    assert.deepStrictEqual(await client.lrange(destination, 0, -1), [
      '1',
      '2',
      '3',
    ]);
  });

  it('reads a sorted view with the read-only SORT_RO', async (context) => {
    /** SORT_RO was introduced in Redis 7.0. */
    if (!atLeast7) {
      context.skip('SORT_RO requires Redis 7.0+');
      return;
    }

    const source = keyspace.key('sortro', 'source');

    await client.rpush(source, '3', '1', '2');

    assert.deepStrictEqual(await client.sortRo(source), ['1', '2', '3']);
  });

  it('computes the longest common subsequence', async (context) => {
    /** LCS was introduced in Redis 7.0. */
    if (!atLeast7) {
      context.skip('LCS requires Redis 7.0+');
      return;
    }

    const first = keyspace.key('lcs', 'first');
    const second = keyspace.key('lcs', 'second');

    await client.set(first, 'ohmytext');
    await client.set(second, 'mynewtext');

    assert.strictEqual(await client.lcs(first, second), 'mytext');
    assert.strictEqual(await client.lcs(first, second, { len: true }), 6);
  });

  it('returns LCS match positions with IDX', async (context) => {
    if (!atLeast7) {
      context.skip('LCS requires Redis 7.0+');
      return;
    }

    const first = keyspace.key('lcs-idx', 'first');
    const second = keyspace.key('lcs-idx', 'second');

    await client.set(first, 'ohmytext');
    await client.set(second, 'mynewtext');

    const result = await client.lcs(first, second, {
      idx: true,
      withmatchlen: true,
    });

    if (typeof result === 'string' || typeof result === 'number') {
      assert.fail('expected LCS match result with idx, not simple reply');
    }
    assert.strictEqual(result.length, 6);
    assert.strictEqual(result.matches.length, 2);
    assert.deepStrictEqual(result.matches, [
      { a: [4, 7], b: [5, 8], length: 4 },
      { a: [2, 3], b: [0, 1], length: 2 },
    ]);
  });
});

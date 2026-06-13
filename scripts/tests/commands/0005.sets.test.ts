/**
 * Set value type: membership, cardinality, random sampling, cross-set algebra
 * (diff/inter/union and their STORE variants), and incremental iteration.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('sets', () => {
  let client: FeaturedClient;
  let atLeast7 = false;
  const keyspace = createKeyspace('sets');

  before(async () => {
    client = await createClient();
    atLeast7 = (await detectServerCapabilities(client)).atLeast(7, 0);
  });

  after(async () => {
    await closeClient(client);
  });

  it('adds members and reports cardinality', async () => {
    const key = keyspace.key('add');

    assert.strictEqual(await client.sadd(key, 'a', 'b', 'c'), 3);
    assert.strictEqual(await client.sadd(key, 'a', 'd'), 1);
    assert.strictEqual(await client.scard(key), 4);
  });

  it('tests membership individually and in bulk', async () => {
    const key = keyspace.key('membership');

    await client.sadd(key, 'a', 'b', 'c');

    assert.strictEqual(await client.sismember(key, 'a'), 1);
    assert.strictEqual(await client.sismember(key, 'z'), 0);
    assert.deepStrictEqual(
      await client.smismember(key, ['a', 'z', 'c']),
      [1, 0, 1],
    );
  });

  it('returns members and removes them', async () => {
    const key = keyspace.key('members');

    await client.sadd(key, 'a', 'b', 'c');

    assert.deepStrictEqual([...(await client.smembers(key))].sort(), [
      'a',
      'b',
      'c',
    ]);
    assert.strictEqual(await client.srem(key, 'a', 'b'), 2);
    assert.deepStrictEqual(await client.smembers(key), ['c']);
  });

  it('pops and samples random members', async () => {
    const key = keyspace.key('random');

    await client.sadd(key, 'a', 'b', 'c', 'd', 'e');

    const popped = await client.spop(key);

    assert.ok(typeof popped === 'string');
    assert.ok(['a', 'b', 'c', 'd', 'e'].includes(popped));
    assert.strictEqual(await client.scard(key), 4);

    const sample = await client.srandmember(key, 2);

    assert.ok(Array.isArray(sample));
    assert.strictEqual(sample.length, 2);

    const single = await client.srandmember(key);

    assert.strictEqual(typeof single, 'string');
  });

  it('moves a member between sets', async () => {
    const source = keyspace.key('move', 'source');
    const destination = keyspace.key('move', 'destination');

    await client.sadd(source, 'a', 'b');

    assert.strictEqual(await client.smove(source, destination, 'a'), 1);
    assert.strictEqual(await client.sismember(destination, 'a'), 1);
    assert.strictEqual(await client.sismember(source, 'a'), 0);
    assert.strictEqual(await client.smove(source, destination, 'absent'), 0);
  });

  it('computes difference, intersection, and union', async () => {
    const first = keyspace.key('algebra', 'first');
    const second = keyspace.key('algebra', 'second');

    await client.sadd(first, 'a', 'b', 'c', 'd');
    await client.sadd(second, 'c', 'd', 'e');

    assert.deepStrictEqual([...(await client.sdiff(first, second))].sort(), [
      'a',
      'b',
    ]);
    assert.deepStrictEqual([...(await client.sinter(first, second))].sort(), [
      'c',
      'd',
    ]);
    assert.deepStrictEqual([...(await client.sunion(first, second))].sort(), [
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('computes intersection cardinality with SINTERCARD', async (context) => {
    /** SINTERCARD was introduced in Redis 7.0. */
    if (!atLeast7) {
      context.skip('SINTERCARD requires Redis 7.0+');
      return;
    }

    const first = keyspace.key('intercard', 'first');
    const second = keyspace.key('intercard', 'second');

    await client.sadd(first, 'a', 'b', 'c', 'd');
    await client.sadd(second, 'c', 'd', 'e');

    assert.strictEqual(await client.sintercard([first, second]), 2);
    assert.strictEqual(await client.sintercard([first, second], 1), 1);
  });

  it('stores the result of set algebra', async () => {
    const first = keyspace.key('store', 'first');
    const second = keyspace.key('store', 'second');

    await client.sadd(first, 'a', 'b', 'c', 'd');
    await client.sadd(second, 'c', 'd', 'e');

    assert.strictEqual(
      await client.sdiffstore(keyspace.key('store', 'diff'), [first, second]),
      2,
    );
    assert.strictEqual(
      await client.sinterstore(keyspace.key('store', 'inter'), [first, second]),
      2,
    );
    assert.strictEqual(
      await client.sunionstore(keyspace.key('store', 'union'), [first, second]),
      5,
    );
  });

  it('iterates a large set with SSCAN', async () => {
    const key = keyspace.key('sscan');
    const members = Array.from(
      { length: 500 },
      (_unused, index) => `m-${index}`,
    );

    await client.sadd(key, ...members);

    const seen = new Set<string>();

    for await (const batch of client.sscan(key, { count: 50 })) {
      for (const member of batch) {
        seen.add(member);
      }
    }

    assert.strictEqual(seen.size, 500);
  });
});

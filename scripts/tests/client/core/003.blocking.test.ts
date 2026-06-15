/** Blocking list and sorted-set commands. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
} from '../../utils/index.ts';

import type { FeaturedClient } from '../../utils/index.ts';

describe('blocking', () => {
  let client: FeaturedClient;
  let atLeast7 = false;
  const keyspace = createKeyspace('blocking');

  before(async () => {
    client = await createClient();
    atLeast7 = (await detectServerCapabilities(client)).atLeast(7, 0);
  });

  after(async () => {
    await closeClient(client);
  });

  it('pops from the left with BLPOP', async () => {
    const key = keyspace.key('blpop');

    await client.rpush(key, 'a', 'b', 'c');

    const result = await client.blpop([key], 0);

    assert.deepStrictEqual(result, [key, 'a']);
  });

  it('returns null from BLPOP on timeout', async () => {
    const key = keyspace.key('blpop-timeout');

    const result = await client.blpop([key], 0.01);

    assert.strictEqual(result, null);
  });

  it('pops from the right with BRPOP', async () => {
    const key = keyspace.key('brpop');

    await client.rpush(key, 'a', 'b', 'c');

    const result = await client.brpop([key], 0);

    assert.deepStrictEqual(result, [key, 'c']);
  });

  it('returns null from BRPOP on timeout', async () => {
    const key = keyspace.key('brpop-timeout');

    const result = await client.brpop([key], 0.01);

    assert.strictEqual(result, null);
  });

  it('moves elements atomically with BLMOVE', async () => {
    const source = keyspace.key('blmove-source');
    const destination = keyspace.key('blmove-destination');

    await client.rpush(source, 'x', 'y', 'z');

    const moved = await client.blmove(source, destination, 'LEFT', 'RIGHT', 0);

    assert.strictEqual(moved, 'x');
    assert.deepStrictEqual(await client.lrange(destination, 0, -1), ['x']);
  });

  it('returns null from BLMOVE on timeout', async () => {
    const source = keyspace.key('blmove-empty');
    const destination = keyspace.key('blmove-empty-destination');

    const result = await client.blmove(
      source,
      destination,
      'LEFT',
      'RIGHT',
      0.01,
    );

    assert.strictEqual(result, null);
  });

  it('pops multiple elements with BLMPOP', async (context) => {
    if (!atLeast7) {
      context.skip('BLMPOP requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('blmpop');

    await client.rpush(key, 'a', 'b', 'c', 'd');

    const result = await client.blmpop(0, [key], 'LEFT', 2);

    assert.notStrictEqual(result, null);

    if (result === null) {
      return;
    }

    assert.strictEqual(result.key, key);
    assert.deepStrictEqual(result.elements, ['a', 'b']);
  });

  it('returns null from BLMPOP on timeout', async (context) => {
    if (!atLeast7) {
      context.skip('BLMPOP requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('blmpop-empty');

    const result = await client.blmpop(0.01, [key], 'LEFT');

    assert.strictEqual(result, null);
  });

  it('moves right-to-left with BRPOPLPUSH', async () => {
    const source = keyspace.key('brpoplpush-source');
    const destination = keyspace.key('brpoplpush-destination');

    await client.rpush(source, 'first', 'second');

    const moved = await client.brpoplpush(source, destination, 0);

    assert.strictEqual(moved, 'second');
    assert.deepStrictEqual(await client.lrange(destination, 0, -1), ['second']);
  });

  it('returns null from BZPOPMIN on timeout', async () => {
    const key = keyspace.key('bzpopmin-timeout');

    const result = await client.bzpopmin([key], 0.01);

    assert.strictEqual(result, null);
  });

  it('returns null from BZPOPMAX on timeout', async () => {
    const key = keyspace.key('bzpopmax-timeout');

    const result = await client.bzpopmax([key], 0.01);

    assert.strictEqual(result, null);
  });

  it('pops the minimum scored member with BZPOPMIN', async () => {
    const key = keyspace.key('bzpopmin');

    await client.zadd(key, 1, 'low');
    await client.zadd(key, 5, 'mid');
    await client.zadd(key, 10, 'high');

    const result = await client.bzpopmin([key], 0);

    assert.notStrictEqual(result, null);

    if (result === null) {
      return;
    }

    assert.strictEqual(result[0], key);
    assert.strictEqual(result[1], 'low');
    assert.strictEqual(result[2], '1');
  });

  it('pops the maximum scored member with BZPOPMAX', async () => {
    const key = keyspace.key('bzpopmax');

    await client.zadd(key, 1, 'low');
    await client.zadd(key, 5, 'mid');
    await client.zadd(key, 10, 'high');

    const result = await client.bzpopmax([key], 0);

    assert.notStrictEqual(result, null);

    if (result === null) {
      return;
    }

    assert.strictEqual(result[0], key);
    assert.strictEqual(result[1], 'high');
    assert.strictEqual(result[2], '10');
  });

  it('pops from sorted sets with BZMPOP', async (context) => {
    if (!atLeast7) {
      context.skip('BZMPOP requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('bzmpop');

    await client.zadd(key, 1, 'a');
    await client.zadd(key, 2, 'b');
    await client.zadd(key, 3, 'c');

    const result = await client.bzmpop(0, [key], 'MIN', 2);

    assert.notStrictEqual(result, null);

    if (result === null) {
      return;
    }

    assert.strictEqual(result.key, key);
    assert.strictEqual(result.elements.length, 2);
    assert.strictEqual(result.elements[0].member, 'a');
    assert.strictEqual(result.elements[0].score, 1);
  });

  it('returns null from BZMPOP on timeout', async (context) => {
    if (!atLeast7) {
      context.skip('BZMPOP requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('bzmpop-empty');

    const result = await client.bzmpop(0.01, [key], 'MIN');

    assert.strictEqual(result, null);
  });
});

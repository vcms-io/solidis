/**
 * List value type: push/pop from both ends, ranged reads, mutation
 * (LSET/LINSERT/LREM/LTRIM), positional lookup (LPOS), and cross-list moves
 * (RPOPLPUSH/LMOVE/LMPOP).
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

describe('lists', () => {
  let client: FeaturedClient;
  let atLeast7 = false;
  const keyspace = createKeyspace('lists');

  before(async () => {
    client = await createClient();
    atLeast7 = (await detectServerCapabilities(client)).atLeast(7, 0);
  });

  after(async () => {
    await closeClient(client);
  });

  it('pushes and pops from both ends', async () => {
    const key = keyspace.key('push-pop');

    assert.strictEqual(await client.rpush(key, 'b', 'c'), 2);
    assert.strictEqual(await client.lpush(key, 'a'), 3);

    assert.deepStrictEqual(await client.lrange(key, 0, -1), ['a', 'b', 'c']);
    assert.strictEqual(await client.lpop(key), 'a');
    assert.strictEqual(await client.rpop(key), 'c');
    assert.strictEqual(await client.llen(key), 1);
    assert.deepStrictEqual(await client.lrange(key, 0, -1), ['b']);
  });

  it('only pushes onto existing lists with *PUSHX', async () => {
    const key = keyspace.key('pushx');

    assert.strictEqual(await client.lpushx(key, ['value']), 0);
    assert.strictEqual(await client.rpushx(key, ['value']), 0);

    await client.rpush(key, 'seed');

    assert.strictEqual(await client.lpushx(key, ['head']), 2);
    assert.strictEqual(await client.rpushx(key, ['tail']), 3);
    assert.deepStrictEqual(await client.lrange(key, 0, -1), [
      'head',
      'seed',
      'tail',
    ]);
  });

  it('indexes and mutates by position', async () => {
    const key = keyspace.key('index');

    await client.rpush(key, 'one', 'two', 'three');

    assert.strictEqual(await client.lindex(key, 0), 'one');
    assert.strictEqual(await client.lindex(key, -1), 'three');
    assert.strictEqual(await client.lindex(key, 99), null);

    assert.strictEqual(await client.lset(key, 1, 'TWO'), 'OK');
    assert.strictEqual(await client.lindex(key, 1), 'TWO');
  });

  it('inserts relative to a pivot', async () => {
    const key = keyspace.key('insert');

    await client.rpush(key, 'a', 'c');

    assert.strictEqual(await client.linsert(key, 'BEFORE', 'c', 'b'), 3);
    assert.strictEqual(await client.linsert(key, 'AFTER', 'c', 'd'), 4);
    assert.deepStrictEqual(await client.lrange(key, 0, -1), [
      'a',
      'b',
      'c',
      'd',
    ]);
    assert.strictEqual(await client.linsert(key, 'BEFORE', 'absent', 'x'), -1);
  });

  it('removes occurrences with LREM', async () => {
    const key = keyspace.key('lrem');

    await client.rpush(key, 'x', 'y', 'x', 'z', 'x');

    assert.strictEqual(await client.lrem(key, 2, 'x'), 2);
    assert.deepStrictEqual(await client.lrange(key, 0, -1), ['y', 'z', 'x']);
  });

  it('trims a list to a window', async () => {
    const key = keyspace.key('ltrim');

    await client.rpush(key, '0', '1', '2', '3', '4');

    assert.strictEqual(await client.ltrim(key, 1, 3), 'OK');
    assert.deepStrictEqual(await client.lrange(key, 0, -1), ['1', '2', '3']);
  });

  it('locates elements with LPOS', async () => {
    const key = keyspace.key('lpos');

    await client.rpush(key, 'a', 'b', 'c', 'b', 'b');

    assert.strictEqual(await client.lpos(key, 'b'), 1);
    assert.strictEqual(await client.lpos(key, 'b', { rank: -1 }), 4);
    assert.deepStrictEqual(await client.lpos(key, 'b', { count: 2 }), [1, 3]);
    assert.deepStrictEqual(
      await client.lpos(key, 'b', { count: 0, maxlen: 3 }),
      [1],
    );
    assert.strictEqual(await client.lpos(key, 'absent'), null);
  });

  it('moves between lists with RPOPLPUSH', async () => {
    const source = keyspace.key('rpoplpush', 'source');
    const destination = keyspace.key('rpoplpush', 'destination');

    await client.rpush(source, 'a', 'b', 'c');

    assert.strictEqual(await client.rpoplpush(source, destination), 'c');
    assert.deepStrictEqual(await client.lrange(destination, 0, -1), ['c']);
  });

  it('moves with directional LMOVE', async () => {
    const source = keyspace.key('lmove', 'source');
    const destination = keyspace.key('lmove', 'destination');

    await client.rpush(source, 'a', 'b', 'c');

    assert.strictEqual(
      await client.lmove(source, destination, 'LEFT', 'RIGHT'),
      'a',
    );
    assert.strictEqual(
      await client.lmove(source, destination, 'RIGHT', 'LEFT'),
      'c',
    );
    assert.deepStrictEqual(await client.lrange(destination, 0, -1), ['c', 'a']);
  });

  it('pops from the first non-empty list with LMPOP', async (context) => {
    /** LMPOP was introduced in Redis 7.0. */
    if (!atLeast7) {
      context.skip('LMPOP requires Redis 7.0+');
      return;
    }

    const first = keyspace.key('lmpop', 'first');
    const second = keyspace.key('lmpop', 'second');

    await client.rpush(second, 'x', 'y', 'z');

    const result = await client.lmpop([first, second], 'LEFT', 2);

    assert.deepStrictEqual(result, { key: second, elements: ['x', 'y'] });

    const empty = await client.lmpop([keyspace.key('lmpop', 'none')], 'LEFT');

    assert.strictEqual(empty, null);
  });
});

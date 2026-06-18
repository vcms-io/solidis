/**
 * Sorted-set value type: scoring, ranking, range queries (by index, score, and
 * lexicographic order), pops, random sampling, set algebra, and iteration.
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

describe('sorted-sets', () => {
  let client: FeaturedClient;
  let atLeast7 = false;
  const keyspace = createKeyspace('zsets');

  const seed = async (
    key: string,
    entries: [number, string][],
  ): Promise<void> => {
    for (const [score, member] of entries) {
      await client.zadd(key, score, member);
    }
  };

  before(async () => {
    client = await createClient();
    atLeast7 = (await detectServerCapabilities(client)).atLeast(7, 0);
  });

  after(async () => {
    await closeClient(client);
  });

  it('adds members and reads scores', async () => {
    const key = keyspace.key('score');

    assert.strictEqual(await client.zadd(key, 1, 'one'), 1);
    assert.strictEqual(await client.zadd(key, 2, 'two'), 1);
    assert.strictEqual(await client.zadd(key, 2.5, 'two'), 0);

    assert.strictEqual(await client.zscore(key, 'two'), 2.5);
    assert.strictEqual(await client.zscore(key, 'absent'), null);
    assert.deepStrictEqual(
      await client.zmscore(key, ['one', 'absent', 'two']),
      [1, null, 2.5],
    );
    assert.strictEqual(await client.zcard(key), 2);
  });

  it('increments scores with ZINCRBY', async () => {
    const key = keyspace.key('incrby');

    await client.zadd(key, 1, 'member');

    assert.strictEqual(await client.zincrby(key, 4, 'member'), 5);
    assert.strictEqual(await client.zincrby(key, -2, 'member'), 3);
  });

  it('reports ranks in both directions', async () => {
    const key = keyspace.key('rank');

    await seed(key, [
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ]);

    assert.strictEqual(await client.zrank(key, 'a'), 0);
    assert.strictEqual(await client.zrank(key, 'c'), 2);
    assert.strictEqual(await client.zrank(key, 'absent'), null);
    assert.strictEqual(await client.zrevrank(key, 'a'), 2);
  });

  it('queries by index range with and without scores', async () => {
    const key = keyspace.key('range-index');

    await seed(key, [
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ]);

    assert.deepStrictEqual(await client.zrange(key, '0', '-1'), [
      'a',
      'b',
      'c',
    ]);
    assert.deepStrictEqual(
      await client.zrange(key, '0', '-1', { reverse: true }),
      ['c', 'b', 'a'],
    );

    const withScores = await client.zrange(key, '0', '1', {
      withScores: true,
    });

    assert.deepStrictEqual(withScores, [
      { member: 'a', score: 1 },
      { member: 'b', score: 2 },
    ]);
  });

  it('queries by score range', async () => {
    const key = keyspace.key('range-score');

    await seed(key, [
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
      [4, 'd'],
    ]);

    assert.deepStrictEqual(await client.zrangebyscore(key, 2, 3), ['b', 'c']);
    assert.deepStrictEqual(
      await client.zrange(key, '1', '4', {
        byScore: true,
        limit: { offset: 1, count: 2 },
      }),
      ['b', 'c'],
    );
    assert.deepStrictEqual(await client.zrevrangebyscore(key, 3, 2), [
      'c',
      'b',
    ]);
    assert.strictEqual(await client.zcount(key, 2, 3), 2);

    const withScores = await client.zrangebyscore(key, 2, 3, {
      withScores: true,
      limit: { offset: 0, count: 10 },
    });

    assert.deepStrictEqual(withScores, [
      { member: 'b', score: 2 },
      { member: 'c', score: 3 },
    ]);
  });

  it('queries by lexicographic range', async () => {
    const key = keyspace.key('range-lex');

    await seed(key, [
      [0, 'a'],
      [0, 'b'],
      [0, 'c'],
      [0, 'd'],
    ]);

    assert.deepStrictEqual(await client.zrangebylex(key, '[a', '[c'), [
      'a',
      'b',
      'c',
    ]);
    assert.deepStrictEqual(await client.zrangebylex(key, '-', '+'), [
      'a',
      'b',
      'c',
      'd',
    ]);
    assert.strictEqual(await client.zlexcount(key, '-', '+'), 4);
  });

  it('stores a range into a new key with ZRANGESTORE', async () => {
    const source = keyspace.key('store', 'source');
    const destination = keyspace.key('store', 'destination');

    await seed(source, [
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ]);

    assert.strictEqual(
      await client.zrangestore(destination, source, '0', '1'),
      2,
    );
    assert.deepStrictEqual(await client.zrange(destination, '0', '-1'), [
      'a',
      'b',
    ]);
  });

  it('pops the lowest and highest members', async () => {
    const key = keyspace.key('pop');

    await seed(key, [
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ]);

    assert.deepStrictEqual(await client.zpopmin(key), [
      { member: 'a', score: 1 },
    ]);
    assert.deepStrictEqual(await client.zpopmax(key, 2), [
      { member: 'c', score: 3 },
      { member: 'b', score: 2 },
    ]);
    assert.deepStrictEqual(await client.zpopmin(key), []);
  });

  it('returns null from ZMPOP when all sets are empty', async (context) => {
    /** ZMPOP was introduced in Redis 7.0. */
    if (!atLeast7) {
      context.skip('ZMPOP requires Redis 7.0+');
      return;
    }

    assert.strictEqual(
      await client.zmpop([keyspace.key('zmpop', 'empty')], 'MIN'),
      null,
    );
  });

  it('pops scored members from the first non-empty set with ZMPOP', async (context) => {
    if (!atLeast7) {
      context.skip('ZMPOP requires Redis 7.0+');
      return;
    }

    const first = keyspace.key('zmpop', 'first');
    const second = keyspace.key('zmpop', 'second');

    await seed(second, [
      [1, 'a'],
      [2, 'b'],
    ]);

    const result = await client.zmpop([first, second], 'MIN', 2);

    assert.deepStrictEqual(result, {
      key: second,
      elements: [
        { member: 'a', score: 1 },
        { member: 'b', score: 2 },
      ],
    });
  });

  it('samples random members with ZRANDMEMBER', async () => {
    const key = keyspace.key('randmember');

    await seed(key, [
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ]);

    const single = await client.zrandmember(key);

    assert.ok(typeof single === 'string');
    assert.ok(['a', 'b', 'c'].includes(single));

    const several = await client.zrandmember(key, 2);

    assert.ok(Array.isArray(several));
    assert.strictEqual(several.length, 2);

    const withScores = await client.zrandmember(key, 3, true);

    assert.ok(Array.isArray(withScores));
    assert.strictEqual(withScores.length, 3);
  });

  it('removes members and ranges', async () => {
    const key = keyspace.key('remove');

    await seed(key, [
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
      [4, 'd'],
      [5, 'e'],
    ]);

    assert.strictEqual(await client.zrem(key, 'a', 'b'), 2);
    assert.strictEqual(await client.zremrangebyscore(key, 3, 4), 2);
    assert.deepStrictEqual(await client.zrange(key, '0', '-1'), ['e']);
  });

  it('removes by lexicographic range', async () => {
    const key = keyspace.key('remove-lex');

    await seed(key, [
      [0, 'a'],
      [0, 'b'],
      [0, 'c'],
    ]);

    assert.strictEqual(await client.zremrangebylex(key, '[a', '[b'), 2);
    assert.deepStrictEqual(await client.zrange(key, '0', '-1'), ['c']);
  });

  it('computes diff, inter, and union', async () => {
    const first = keyspace.key('algebra', 'first');
    const second = keyspace.key('algebra', 'second');

    await seed(first, [
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ]);
    await seed(second, [
      [1, 'b'],
      [1, 'c'],
      [1, 'd'],
    ]);

    assert.deepStrictEqual(await client.zdiff([first, second]), ['a']);
    assert.deepStrictEqual([...(await client.zinter([first, second]))].sort(), [
      'b',
      'c',
    ]);
    assert.deepStrictEqual([...(await client.zunion([first, second]))].sort(), [
      'a',
      'b',
      'c',
      'd',
    ]);

    assert.deepStrictEqual(await client.zdiff([first, second], true), [
      { member: 'a', score: 1 },
    ]);

    assert.deepStrictEqual(
      await client.zinter([first, second], { withScores: true }),
      [
        { member: 'b', score: 3 },
        { member: 'c', score: 4 },
      ],
    );

    assert.deepStrictEqual(
      await client.zunion([first, second], { withScores: true }),
      [
        { member: 'a', score: 1 },
        { member: 'd', score: 1 },
        { member: 'b', score: 3 },
        { member: 'c', score: 4 },
      ],
    );
  });

  it('computes intersection cardinality with ZINTERCARD', async (context) => {
    /** ZINTERCARD was introduced in Redis 7.0. */
    if (!atLeast7) {
      context.skip('ZINTERCARD requires Redis 7.0+');
      return;
    }

    const first = keyspace.key('intercard', 'first');
    const second = keyspace.key('intercard', 'second');

    await seed(first, [
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ]);
    await seed(second, [
      [1, 'b'],
      [1, 'c'],
      [1, 'd'],
    ]);

    assert.strictEqual(await client.zintercard([first, second]), 2);
    assert.strictEqual(await client.zintercard([first, second], 1), 1);
  });

  it('stores diff, inter, and union', async () => {
    const first = keyspace.key('algebra-store', 'first');
    const second = keyspace.key('algebra-store', 'second');

    await seed(first, [
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ]);
    await seed(second, [
      [1, 'b'],
      [1, 'c'],
    ]);

    assert.strictEqual(
      await client.zdiffstore(keyspace.key('algebra-store', 'diff'), [
        first,
        second,
      ]),
      1,
    );
    assert.strictEqual(
      await client.zinterstore(keyspace.key('algebra-store', 'inter'), [
        first,
        second,
      ]),
      2,
    );
    assert.strictEqual(
      await client.zunionstore(
        keyspace.key('algebra-store', 'union'),
        [first, second],
        { aggregate: 'MAX' },
      ),
      3,
    );
    assert.strictEqual(
      await client.zunionstore(
        keyspace.key('algebra-store', 'weighted'),
        [first, second],
        { weights: [2, 1], aggregate: 'SUM' },
      ),
      3,
    );
  });

  it('stores a range by lex with ZRANGESTORE BYLEX', async () => {
    const source = keyspace.key('rangestore-lex-src');
    const destination = keyspace.key('rangestore-lex-dst');

    await client.zadd(source, 0, 'alpha');
    await client.zadd(source, 0, 'beta');
    await client.zadd(source, 0, 'gamma');

    const count = await client.zrangestore(
      destination,
      source,
      '[alpha',
      '[beta',
      { byLex: true },
    );

    assert.strictEqual(count, 2);
  });

  it('iterates a large sorted set with ZSCAN', async () => {
    const key = keyspace.key('zscan');

    for (let index = 0; index < 400; index += 1) {
      await client.zadd(key, index, `member-${index}`);
    }

    const seen = new Map<string, number>();

    for await (const batch of client.zscan(key, { count: 50 })) {
      for (const entry of batch) {
        seen.set(entry.member, entry.score);
      }
    }

    assert.strictEqual(seen.size, 400);
    assert.strictEqual(seen.get('member-123'), 123);
  });

  it('returns members in reverse order with ZREVRANGE', async () => {
    const key = keyspace.key('zrevrange');

    await client.zadd(key, 1, 'a');
    await client.zadd(key, 2, 'b');
    await client.zadd(key, 3, 'c');

    const result = await client.zrevrange(key, 0, -1);

    assert.deepStrictEqual(result, ['c', 'b', 'a']);
  });

  it('returns members in reverse lexicographical order with ZREVRANGEBYLEX', async () => {
    const key = keyspace.key('zrevrangebylex');

    await client.zadd(key, 0, 'a');
    await client.zadd(key, 0, 'b');
    await client.zadd(key, 0, 'c');
    await client.zadd(key, 0, 'd');

    const result = await client.zrevrangebylex(key, '+', '-');

    assert.deepStrictEqual(result, ['d', 'c', 'b', 'a']);

    const partial = await client.zrevrangebylex(key, '[c', '[a');

    assert.deepStrictEqual(partial, ['c', 'b', 'a']);
  });

  it('uses ZRANGEBYLEX with LIMIT option', async () => {
    const key = keyspace.key('zrangebylex-limit');

    await client.zadd(key, 0, 'a');
    await client.zadd(key, 0, 'b');
    await client.zadd(key, 0, 'c');
    await client.zadd(key, 0, 'd');
    await client.zadd(key, 0, 'e');

    const result = await client.zrangebylex(key, '-', '+', {
      offset: 1,
      count: 2,
    });

    assert.deepStrictEqual(result, ['b', 'c']);
  });

  it('returns empty from ZPOPMAX on non-existing key', async () => {
    const result = await client.zpopmax(keyspace.key('zpopmax-missing'));

    assert.deepStrictEqual(result, []);
  });

  it('returns empty from ZPOPMIN on non-existing key', async () => {
    const result = await client.zpopmin(keyspace.key('zpopmin-missing'));

    assert.deepStrictEqual(result, []);
  });

  it('returns null scores from ZMSCORE for missing members', async () => {
    const key = keyspace.key('zmscore-null');

    await client.zadd(key, 1, 'a');
    await client.zadd(key, 2, 'b');

    const scores = await client.zmscore(key, ['a', 'missing', 'b']);

    assert.strictEqual(scores[0], 1);
    assert.strictEqual(scores[1], null);
    assert.strictEqual(scores[2], 2);
  });

  it('returns null from ZMPOP on empty keys', async (context) => {
    if (!atLeast7) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const result = await client.zmpop([keyspace.key('zmpop-empty')], 'MIN');

    assert.strictEqual(result, null);
  });

  it('pops multiple with ZMPOP COUNT', async (context) => {
    if (!atLeast7) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('zmpop-count');

    await client.zadd(key, 1, 'a');
    await client.zadd(key, 2, 'b');
    await client.zadd(key, 3, 'c');

    const result = await client.zmpop([key], 'MIN', 2);

    assert.ok(result !== null);
    assert.strictEqual(result.key, key);
    /** MIN pops the two lowest-scored members in ascending order. */
    assert.deepStrictEqual(result.elements, [
      { member: 'a', score: 1 },
      { member: 'b', score: 2 },
    ]);
  });

  it('pops with ZPOPMIN count argument', async () => {
    const key = keyspace.key('zpopmin-count');

    await client.zadd(key, 1, 'x');
    await client.zadd(key, 2, 'y');

    const result = await client.zpopmin(key, 2);

    assert.ok(result !== null);
    assert.deepStrictEqual(result, [
      { member: 'x', score: 1 },
      { member: 'y', score: 2 },
    ]);
  });
});

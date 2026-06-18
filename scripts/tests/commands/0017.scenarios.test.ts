/** Realistic multi-command application scenarios. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  delay,
  range,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('scenarios', () => {
  let client: FeaturedClient;
  const keyspace = createKeyspace('scenarios');

  before(async () => {
    client = await createClient();
  });

  after(async () => {
    await closeClient(client);
  });

  it('enforces a fixed-window rate limit', async () => {
    const key = keyspace.key('ratelimit', 'user-1');
    const limit = 5;

    const allow = async (): Promise<boolean> => {
      const count = await client.incr(key);

      if (count === 1) {
        await client.expire(key, 60);
      }

      return count <= limit;
    };

    const verdicts: boolean[] = [];

    for (let attempt = 0; attempt < 7; attempt += 1) {
      verdicts.push(await allow());
    }

    assert.deepStrictEqual(verdicts, [
      true,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);

    const ttl = await client.ttl(key);

    assert.ok(ttl >= 1 && ttl <= 60);
  });

  it('maintains a leaderboard with sorted sets', async () => {
    const board = keyspace.key('leaderboard');

    await Promise.all([
      client.zadd(board, 100, 'alice'),
      client.zadd(board, 250, 'bob'),
      client.zadd(board, 175, 'carol'),
    ]);

    await client.zincrby(board, 200, 'alice');

    const top = await client.zrange(board, '0', '2', {
      reverse: true,
      withScores: true,
    });

    assert.deepStrictEqual(top[0], { member: 'alice', score: 300 });
    assert.deepStrictEqual(top[1], { member: 'bob', score: 250 });
    assert.deepStrictEqual(top[2], { member: 'carol', score: 175 });
    assert.strictEqual(await client.zrevrank(board, 'alice'), 0);
    assert.strictEqual(await client.zrevrank(board, 'bob'), 1);
    assert.strictEqual(await client.zrevrank(board, 'carol'), 2);
  });

  it('implements a producer/consumer work queue', async () => {
    const queue = keyspace.key('jobs');
    const processed = keyspace.key('processed');

    await Promise.all(
      range(20).map((index) => client.rpush(queue, `job-${index}`)),
    );

    const consume = async (): Promise<void> => {
      for (;;) {
        const job = await client.lpop(queue);

        if (job === null) {
          return;
        }

        await client.sadd(processed, job);
      }
    };

    await Promise.all([consume(), consume(), consume()]);

    assert.strictEqual(await client.llen(queue), 0);
    assert.strictEqual(await client.scard(processed), 20);
    assert.deepStrictEqual(
      [...(await client.smembers(processed))].sort(
        (left, right) =>
          Number(left.replace('job-', '')) - Number(right.replace('job-', '')),
      ),
      range(20).map((index) => `job-${index}`),
    );
  });

  it('stores and expires a session as a hash', async () => {
    const session = keyspace.key('session', 'token-123');

    const lastSeen = `${Date.now()}`;

    await client.hmset(session, {
      userId: '42',
      role: 'admin',
      lastSeen,
    });
    await client.expire(session, 30);

    const stored = await client.hgetall(session);

    assert.strictEqual(stored.userId, '42');
    assert.strictEqual(stored.role, 'admin');
    assert.strictEqual(stored.lastSeen, lastSeen);

    const sessionTtl = await client.ttl(session);

    assert.ok(sessionTtl >= 1 && sessionTtl <= 30);

    await client.hdel(session, 'role');

    assert.strictEqual(await client.hexists(session, 'role'), 0);
    assert.deepStrictEqual(await client.hgetall(session), {
      userId: '42',
      lastSeen,
    });
  });

  it('implements cache-aside with a backing loader', async () => {
    const key = keyspace.key('cache', 'product-1');
    let loaderCalls = 0;

    const loadProduct = async (): Promise<string> => {
      loaderCalls += 1;

      await delay(5);

      return JSON.stringify({ id: 1, name: 'widget' });
    };

    const getProduct = async (): Promise<string> => {
      const cached = await client.get(key);

      if (cached !== null) {
        return cached;
      }

      const fresh = await loadProduct();

      await client.set(key, fresh, { expireInSeconds: 60 });

      return fresh;
    };

    const first = await getProduct();
    const second = await getProduct();

    assert.strictEqual(first, second);
    assert.strictEqual(loaderCalls, 1);
    assert.deepStrictEqual(JSON.parse(first), { id: 1, name: 'widget' });
  });

  it('builds a tag index with set intersections', async () => {
    const redItems = keyspace.key('tag', 'red');
    const roundItems = keyspace.key('tag', 'round');

    await client.sadd(redItems, 'ball', 'apple', 'car');
    await client.sadd(roundItems, 'ball', 'apple', 'plate');

    const redAndRound = keyspace.key('tag', 'red-and-round');

    assert.strictEqual(
      await client.sinterstore(redAndRound, [redItems, roundItems]),
      2,
    );
    assert.deepStrictEqual([...(await client.smembers(redAndRound))].sort(), [
      'apple',
      'ball',
    ]);
  });

  it('transfers funds atomically with a WATCH/MULTI transaction', async () => {
    const source = keyspace.key('account', 'source');
    const destination = keyspace.key('account', 'destination');

    await client.set(source, '100');
    await client.set(destination, '0');

    const transfer = async (amount: number): Promise<boolean> => {
      await client.watch(source);

      const balance = Number.parseInt((await client.get(source)) ?? '0', 10);

      if (balance < amount) {
        await client.unwatch();

        return false;
      }

      const transaction = client.multi();
      transaction.decrby(source, amount);
      transaction.incrby(destination, amount);

      const results = await transaction.exec();

      return results.length > 0 && results[0] !== null;
    };

    assert.strictEqual(await transfer(60), true);
    assert.strictEqual(await client.get(source), '40');
    assert.strictEqual(await client.get(destination), '60');
    assert.strictEqual(await transfer(100), false);
  });

  it('counts unique visitors with HyperLogLog approximation', async () => {
    const visitors = keyspace.key('unique-visitors');

    const ids = range(1000).map((index) => `visitor-${index}`);

    await Promise.all(ids.map((visitor) => client.pfadd(visitors, [visitor])));

    const estimate = await client.pfcount([visitors]);

    /**
     * HyperLogLog cardinality is approximate; standard error is ~0.81% for
     * Redis/Valkey PFCOUNT, so 1000 unique inserts should land near 1000.
     */
    assert.ok(
      estimate >= 990 && estimate <= 1010,
      `expected ~1000 unique visitors but got ${estimate}`,
    );
  });
});

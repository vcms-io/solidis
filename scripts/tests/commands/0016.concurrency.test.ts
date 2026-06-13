/**
 * High-concurrency stress tests. These exercise the requester's pipelining and
 * back-pressure handling under thousands of in-flight commands, across both a
 * single shared connection and many independent clients, and verify that
 * atomic server-side operations stay consistent.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  chunk,
  closeAllClients,
  closeClient,
  createClient,
  createKeyspace,
  range,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('concurrency', () => {
  let client: FeaturedClient;
  const keyspace = createKeyspace('concurrency');

  before(async () => {
    client = await createClient();
  });

  after(async () => {
    await closeClient(client);
    await closeAllClients();
  });

  it('keeps INCR atomic under 2000 concurrent increments on one connection', async () => {
    const key = keyspace.key('atomic-incr');

    await client.set(key, '0');

    const results = await Promise.all(range(2000).map(() => client.incr(key)));

    assert.strictEqual(Math.max(...results), 2000);
    assert.strictEqual(await client.get(key), '2000');
  });

  it('returns correct values for 5000 interleaved set/get pairs', async () => {
    const writes = range(5000).map((index) =>
      client.set(keyspace.key('kv', index), `value-${index}`),
    );

    await Promise.all(writes);

    const reads = await Promise.all(
      range(5000).map((index) => client.get(keyspace.key('kv', index))),
    );

    assert.strictEqual(reads[0], 'value-0');
    assert.strictEqual(reads[4999], 'value-4999');
    assert.strictEqual(
      reads.every((value, index) => value === `value-${index}`),
      true,
    );
  });

  it('fans work across 32 independent clients consistently', async () => {
    const key = keyspace.key('multi-client-counter');

    await client.set(key, '0');

    const clients = await Promise.all(range(32).map(() => createClient()));

    try {
      await Promise.all(
        clients.map((worker) =>
          Promise.all(range(50).map(() => worker.incr(key))),
        ),
      );

      assert.strictEqual(await client.get(key), `${32 * 50}`);
    } finally {
      await Promise.all(clients.map((worker) => closeClient(worker)));
    }
  });

  it('mixes heterogeneous commands in a single concurrent burst', async () => {
    const counter = keyspace.key('mixed', 'counter');
    const list = keyspace.key('mixed', 'list');
    const set = keyspace.key('mixed', 'set');
    const hash = keyspace.key('mixed', 'hash');
    const sortedSet = keyspace.key('mixed', 'zset');

    await client.del(counter, list, set, hash, sortedSet);

    const operations = range(500).flatMap((index) => [
      client.incr(counter),
      client.rpush(list, `item-${index}`),
      client.sadd(set, `member-${index}`),
      client.hset(hash, `field-${index}`, `${index}`),
      client.zadd(sortedSet, index, `member-${index}`),
    ]);

    await Promise.all(operations);

    assert.strictEqual(await client.get(counter), '500');
    assert.strictEqual(await client.llen(list), 500);
    assert.strictEqual(await client.scard(set), 500);
    assert.strictEqual(await client.hlen(hash), 500);
    assert.strictEqual(await client.zcard(sortedSet), 500);
  });

  it('processes very large pipelines submitted with send()', async () => {
    const total = 10000;
    const commands = range(total).map((index) => [
      'SET',
      keyspace.key('pipeline', index),
      `${index}`,
    ]);

    const replies = await client.send(commands);

    assert.strictEqual(replies.length, total);
    assert.strictEqual(
      replies.every((reply) => reply[0] === 'OK'),
      true,
    );
  });

  it('sustains many sequential pipeline batches without leaking', async () => {
    const batches = chunk(range(2000), 200);

    for (const batch of batches) {
      const replies = await Promise.all(
        batch.map((index) =>
          client.set(keyspace.key('sequential', index), `${index}`),
        ),
      );

      assert.strictEqual(
        replies.every((reply) => reply === 'OK'),
        true,
      );
    }

    assert.strictEqual(
      await client.get(keyspace.key('sequential', 1999)),
      '1999',
    );
  });

  it('interleaves reads and writes on shared keys without corruption', async () => {
    const key = keyspace.key('shared-list');

    await client.del(key);

    const producers = range(1000).map((index) => client.rpush(key, `${index}`));

    await Promise.all(producers);

    const length = await client.llen(key);
    const items = await client.lrange(key, 0, -1);

    assert.strictEqual(length, 1000);
    assert.strictEqual(items.length, 1000);
    assert.strictEqual(new Set(items).size, 1000);
  });
});

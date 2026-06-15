/** MULTI/EXEC transactions, DISCARD, and WATCH-based optimistic locking. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  delay,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('transactions', () => {
  let client: FeaturedClient;
  const keyspace = createKeyspace('txn');

  before(async () => {
    client = await createClient();
  });

  after(async () => {
    await closeClient(client);
  });

  it('executes a queued transaction atomically', async () => {
    const counter = keyspace.key('counter');
    const value = keyspace.key('value');

    const transaction = client.multi();

    transaction.set(value, 'hello');
    transaction.incr(counter);
    transaction.incr(counter);
    transaction.get(value);

    const results = await transaction.exec();

    /**
     * EXEC must return each queued command's reply in submission order; a
     * misaligned or mistyped reply array would slip past a length-only check.
     */
    assert.strictEqual(results.length, 4);
    assert.strictEqual(results[0], 'OK');
    assert.strictEqual(results[1], 1);
    assert.strictEqual(results[2], 2);
    assert.strictEqual(`${results[3]}`, 'hello');
    assert.strictEqual(await client.get(counter), '2');
    assert.strictEqual(await client.get(value), 'hello');
  });

  it('returns an empty array for an empty transaction', async () => {
    const transaction = client.multi();

    assert.deepStrictEqual(await transaction.exec(), []);
  });

  it('discards a queued transaction', async () => {
    const key = keyspace.key('discard');

    await client.set(key, 'original');

    const transaction = client.multi();

    transaction.set(key, 'changed');
    transaction.discard();

    assert.deepStrictEqual(await transaction.exec(), []);
    assert.strictEqual(await client.get(key), 'original');
  });

  it('aborts EXEC when a watched key changes', async () => {
    const key = keyspace.key('watch', 'changed');

    await client.set(key, '1');

    const lockClient = await createClient();

    try {
      await lockClient.watch(key);

      await client.set(key, 'modified-by-other');

      const transaction = lockClient.multi();
      transaction.set(key, 'should-not-apply');

      const results = await transaction.exec();

      /**
       * A WATCH-aborted EXEC replies with a nil array, surfaced here as a
       * single null entry rather than the per-command reply list.
       */
      assert.deepStrictEqual(results, [null]);
      assert.strictEqual(await client.get(key), 'modified-by-other');
    } finally {
      await closeClient(lockClient);
    }
  });

  it('commits EXEC when a watched key is untouched', async () => {
    const key = keyspace.key('watch', 'stable');

    await client.set(key, '1');

    const lockClient = await createClient();

    try {
      await lockClient.watch(key);

      const transaction = lockClient.multi();
      transaction.incr(key);

      const results = await transaction.exec();

      assert.strictEqual(results.length, 1);
      assert.strictEqual(await client.get(key), '2');
    } finally {
      await closeClient(lockClient);
    }
  });

  it('UNWATCH cancels optimistic locking', async () => {
    const key = keyspace.key('unwatch');

    await client.set(key, '1');

    const lockClient = await createClient();

    try {
      await lockClient.watch(key);
      await lockClient.unwatch();

      await client.set(key, 'modified');

      const transaction = lockClient.multi();
      transaction.set(key, 'committed');

      const results = await transaction.exec();

      assert.strictEqual(results.length, 1);
      assert.strictEqual(await client.get(key), 'committed');
    } finally {
      await closeClient(lockClient);
    }
  });

  it('implements a safe compare-and-swap loop with WATCH', async () => {
    const key = keyspace.key('cas');

    await client.set(key, '0');

    const increment = async (worker: FeaturedClient): Promise<void> => {
      for (;;) {
        await worker.watch(key);

        const current = Number.parseInt((await worker.get(key)) ?? '0', 10);

        const transaction = worker.multi();
        transaction.set(key, `${current + 1}`);

        const results = await transaction.exec();

        /**
         * Success yields the per-command reply list; a WATCH abort yields a
         * single null entry, in which case we retry the read-modify-write.
         */
        if (results.length > 0 && results[0] !== null) {
          return;
        }

        await delay(1);
      }
    };

    const workers = await Promise.all(
      Array.from({ length: 5 }, () => createClient()),
    );

    try {
      await Promise.all(workers.map((worker) => increment(worker)));

      assert.strictEqual(await client.get(key), '5');
    } finally {
      await Promise.all(workers.map((worker) => closeClient(worker)));
    }
  });

  it('multi guard rejects on object without extend method', async () => {
    const { multi } = await import('../../../sources/command/multi.ts');

    assert.throws(
      () => multi.call({}),
      (error: Error) => error.message.includes('Extend'),
    );
  });
});

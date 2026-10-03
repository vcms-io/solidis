/** MULTI/EXEC transactions, DISCARD, and WATCH-based optimistic locking. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../sources/client/featured.ts';
import { RespError, SolidisCommandError } from '../../../sources/index.ts';
import {
  buildClientOptions,
  closeClient,
  createClient,
  createKeyspace,
  delay,
} from '../utils/index.ts';

import type { StringOrBuffer } from '../../../sources/index.ts';
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
    assert.deepStrictEqual(results, ['OK', 1, 2, Buffer.from('hello')]);
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

  it('keeps accepting commands after a discard', async () => {
    const discarded = keyspace.key('reuse', 'discarded');
    const committed = keyspace.key('reuse', 'committed');

    const transaction = client.multi();

    transaction.set(discarded, 'no');
    transaction.discard();
    transaction.set(committed, 'yes');

    assert.deepStrictEqual(await transaction.exec(), ['OK']);
    assert.strictEqual(await client.get(discarded), null);
    assert.strictEqual(await client.get(committed), 'yes');
  });

  it('empties the queue once exec has run', async () => {
    const key = keyspace.key('drained');
    const transaction = client.multi();

    transaction.incr(key);

    assert.deepStrictEqual(await transaction.exec(), [1]);
    assert.deepStrictEqual(await transaction.exec(), []);
    assert.strictEqual(await client.get(key), '1');
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

      assert.strictEqual(await transaction.exec(), null);
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

      assert.deepStrictEqual(results, [2]);
      assert.strictEqual(await client.get(key), '2');
    } finally {
      await closeClient(lockClient);
    }
  });

  it('distinguishes an aborted EXEC from a committed transaction of nulls', async () => {
    const key = keyspace.key('watch', 'null-reply');
    const missing = keyspace.key('watch', 'missing');

    const transaction = client.multi();

    transaction.get(missing);

    assert.deepStrictEqual(await transaction.exec(), [null]);

    await client.set(key, '1');

    const lockClient = await createClient();

    try {
      await lockClient.watch(key);
      await client.set(key, '2');

      const aborted = lockClient.multi();

      aborted.get(missing);

      assert.strictEqual(await aborted.exec(), null);
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

      assert.deepStrictEqual(results, ['OK']);
      assert.strictEqual(await client.get(key), 'committed');
    } finally {
      await closeClient(lockClient);
    }
  });

  it('implements a safe compare-and-swap loop with WATCH', async () => {
    const key = keyspace.key('cas');
    const workerCount = 5;

    await client.set(key, '0');

    const increment = async (worker: FeaturedClient): Promise<void> => {
      for (;;) {
        await worker.watch(key);

        const current = Number.parseInt((await worker.get(key)) ?? '0', 10);

        const transaction = worker.multi();
        transaction.set(key, `${current + 1}`);

        const results = await transaction.exec();

        if (results !== null) {
          assert.deepStrictEqual(results, ['OK']);

          return;
        }

        await delay(1);
      }
    };

    const workers = await Promise.all(
      Array.from({ length: workerCount }, () => createClient()),
    );

    try {
      await Promise.all(workers.map((worker) => increment(worker)));

      assert.strictEqual(await client.get(key), `${workerCount}`);
    } finally {
      await Promise.all(workers.map((worker) => closeClient(worker)));
    }
  });

  it('keeps runtime errors inline in the EXEC reply', async () => {
    const key = keyspace.key('runtime-error');
    const transaction = client.multi();

    transaction.set(key, 'text');
    transaction.incr(key);
    transaction.get(key);

    const results = await transaction.exec();

    if (results === null) {
      assert.fail('an unwatched transaction must not abort');
    }

    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0], 'OK');
    assert.ok(results[1] instanceof RespError);
    assert.strictEqual(results[1].code, 'ERR');
    assert.deepStrictEqual(results[2], Buffer.from('text'));
  });

  it('rejects EXEC when the server discards the transaction at queue time', async () => {
    const key = keyspace.key('execabort');
    const transaction = client.multi();

    transaction.set(key, 'never');
    transaction.del();

    await assert.rejects(transaction.exec(), (error: unknown) => {
      assert.ok(error instanceof SolidisCommandError);
      assert.match(error.message, /^\[EXEC\] EXECABORT /);
      assert.ok(error.cause instanceof RespError);
      assert.strictEqual(error.cause.code, 'EXECABORT');

      return true;
    });

    assert.strictEqual(await client.get(key), null);
    assert.strictEqual(await client.ping(), 'PONG');
  });

  it('never queues direct client calls made while a transaction is open', async () => {
    const key = keyspace.key('direct');
    const transaction = client.multi();

    transaction.set(key, 'queued');

    assert.strictEqual(await client.set(key, 'direct'), 'OK');
    assert.strictEqual(await client.get(key), 'direct');
    assert.deepStrictEqual(await transaction.exec(), ['OK']);
    assert.strictEqual(await client.get(key), 'queued');
  });

  it('keeps interleaved transactions on one client separate', async () => {
    const first = keyspace.key('interleaved', 'first');
    const second = keyspace.key('interleaved', 'second');

    const left = client.multi();
    const right = client.multi();

    for (let index = 0; index < 10; index += 1) {
      left.incr(first);
      right.incrby(second, 2);
    }

    const [leftResults, rightResults] = await Promise.all([
      left.exec(),
      right.exec(),
    ]);

    assert.deepStrictEqual(
      leftResults,
      Array.from({ length: 10 }, (_, index) => index + 1),
    );
    assert.deepStrictEqual(
      rightResults,
      Array.from({ length: 10 }, (_, index) => (index + 1) * 2),
    );
  });

  it('multi rejects an object without a send method', async () => {
    const { multi } = await import('../../../sources/command/multi.ts');

    assert.throws(() => multi.call({}), {
      message: '[MULTI] Send method is not implemented',
    });
  });

  it('propagates command-building errors from the transaction proxy to exec', async () => {
    const key = keyspace.key('propagate');
    const transaction = client.multi();

    transaction.set(key, 'value');
    transaction.xread(['stream-a', 'stream-b'], ['0-0']);

    await assert.rejects(transaction.exec(), {
      message: '[XREAD] Keys and IDs must have the same length',
    });

    assert.strictEqual(await client.get(key), null);
    assert.deepStrictEqual(await transaction.exec(), []);
  });

  it('handles discard on an empty pipeline gracefully', async () => {
    const transaction = client.multi();

    transaction.discard();

    assert.deepStrictEqual(await transaction.exec(), []);
  });

  it('returns undefined when accessing a non-function property through the transaction proxy', () => {
    const transaction = client.multi();
    const value = (transaction as Record<string, unknown>).nonExistentProperty;

    assert.strictEqual(value, undefined);
  });

  it('rejects an EXEC reply that is neither a reply list nor null', async () => {
    const { multi } = await import('../../../sources/command/multi.ts');
    const { set } = await import('../../../sources/command/set.ts');

    const sender = {
      multi,
      set,
      send: async (commands: StringOrBuffer[][]) =>
        commands.map((_, index) => [
          index === commands.length - 1 ? 'unexpected' : 'QUEUED',
        ]),
    };
    const transaction = sender.multi();

    transaction.set('key', 'value');

    await assert.rejects(transaction.exec(), {
      name: 'SolidisCommandError',
      message: '[EXEC] Unexpected reply: string',
    });
  });

  it('reports a MULTI the server refuses, after which the queued commands ran alone', async () => {
    const user = `solidis-txn-${Date.now()}`;
    const counter = keyspace.key('refused-multi');

    await client.aclSetuser(
      user,
      'reset',
      'on',
      '>pw',
      '~*',
      '&*',
      '+@read',
      '+@write',
    );

    const restricted = await createClient({
      authentication: { username: user, password: 'pw' },
    });

    try {
      const transaction = restricted.multi();

      transaction.incr(counter);

      await assert.rejects(transaction.exec(), (error: unknown) => {
        assert.ok(error instanceof SolidisCommandError);
        assert.match(error.message, /^\[MULTI\] NOPERM /);

        return true;
      });
      assert.strictEqual(await client.get(counter), '1');
    } finally {
      await closeClient(restricted);
      await client.aclDeluser(user);
    }
  });

  it('queues the methods that a client subclass defines', async () => {
    class SessionClient extends SolidisFeaturedClient {
      touchSession(key: string) {
        return this.expire(key, 60);
      }
    }

    const session = new SessionClient(
      buildClientOptions({ lazyConnect: true }),
    );
    const key = keyspace.key('session');

    session.on('error', () => {});

    try {
      await session.connect();

      const transaction = session.multi();

      transaction.set(key, 'value');
      transaction.touchSession(key);

      assert.deepStrictEqual(await transaction.exec(), ['OK', 1]);
      assert.ok((await client.ttl(key)) > 0);
    } finally {
      session.quit();
    }
  });

  it('ends a WATCH that an empty exec, a discard or a rejected exec leaves behind', async () => {
    const watched = keyspace.key('armed', 'watched');
    const target = keyspace.key('armed', 'target');
    const other = await createClient();
    const abandonments = [
      async () => {
        assert.strictEqual(await client.multi().exec(), null);
      },
      () => {
        const transaction = client.multi();

        transaction.set(target, 'discarded');
        transaction.discard();
      },
      async () => {
        const transaction = client.multi();

        transaction.xread(['a', 'b'], ['0']);

        await assert.rejects(transaction.exec());
      },
    ];

    try {
      for (const [index, abandon] of abandonments.entries()) {
        await client.watch(watched);
        await other.set(watched, `${index}`);
        await abandon();

        const next = client.multi();

        next.set(target, `${index}`);

        assert.deepStrictEqual(await next.exec(), ['OK'], `${index}`);
        assert.strictEqual(await client.get(target), `${index}`);
      }
    } finally {
      await closeClient(other);
    }
  });
});

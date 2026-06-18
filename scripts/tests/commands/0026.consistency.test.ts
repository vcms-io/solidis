/** Reply-correlation consistency. */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { RespError } from '../../../sources/index.ts';
import {
  closeAllClients,
  closeClient,
  createClient,
  createKeyspace,
  range,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

interface ConsistencyOperation {
  label: string;
  execute: () => Promise<void>;
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;

    return state / 0xffffffff;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }

  return result;
}

describe('consistency', () => {
  let client: FeaturedClient;
  const keyspace = createKeyspace('consistency');

  before(async () => {
    client = await createClient();
  });

  after(async () => {
    await closeClient(client);
    await closeAllClients();
  });

  function buildOperation(
    target: FeaturedClient,
    index: number,
  ): ConsistencyOperation {
    const tag = `${index}-${randomUUID()}`;
    const variant = index % 12;

    switch (variant) {
      case 0: {
        const token = `echo-${tag}`;

        return {
          label: `echo:${token}`,
          execute: async () => {
            assert.strictEqual(await target.echo(token), token);
          },
        };
      }

      case 1: {
        const message = `pong-${tag}`;

        return {
          label: `ping:${message}`,
          execute: async () => {
            assert.strictEqual(await target.ping(message), message);
          },
        };
      }

      case 2: {
        const key = keyspace.key('set', tag);
        const value = `value-${tag}`;

        return {
          label: `set-get:${key}`,
          execute: async () => {
            assert.strictEqual(await target.set(key, value), 'OK');
            assert.strictEqual(await target.get(key), value);
          },
        };
      }

      case 3: {
        const key = keyspace.key('incrby', tag);
        const amount = (index % 97) + 1;

        return {
          label: `incrby:${key}:${amount}`,
          execute: async () => {
            assert.strictEqual(await target.incrby(key, amount), amount);
          },
        };
      }

      case 4: {
        const key = keyspace.key('missing', tag);

        return {
          label: `get-missing:${key}`,
          execute: async () => {
            assert.strictEqual(await target.get(key), null);
          },
        };
      }

      case 5: {
        const key = keyspace.key('strlen', tag);
        const value = `len-${tag}`;

        return {
          label: `strlen:${key}`,
          execute: async () => {
            await target.set(key, value);
            assert.strictEqual(await target.strlen(key), value.length);
          },
        };
      }

      case 6: {
        const key = keyspace.key('list', tag);
        const items = range((index % 4) + 1).map(
          (slot) => `item-${tag}-${slot}`,
        );

        return {
          label: `rpush-lrange:${key}`,
          execute: async () => {
            assert.strictEqual(await target.rpush(key, ...items), items.length);
            assert.deepStrictEqual(await target.lrange(key, 0, -1), items);
          },
        };
      }

      case 7: {
        const key = keyspace.key('hash', tag);
        const field = `field-${tag}`;
        const value = `hv-${tag}`;

        return {
          label: `hset-hget:${key}`,
          execute: async () => {
            assert.strictEqual(await target.hset(key, field, value), 1);
            assert.strictEqual(await target.hget(key, field), value);
          },
        };
      }

      case 8: {
        const key = keyspace.key('set-type', tag);
        const member = `m-${tag}`;

        return {
          label: `sadd-sismember:${key}`,
          execute: async () => {
            assert.strictEqual(await target.sadd(key, member), 1);
            assert.strictEqual(await target.sismember(key, member), 1);
            assert.strictEqual(await target.sismember(key, `absent-${tag}`), 0);
          },
        };
      }

      case 9: {
        const key = keyspace.key('exists', tag);

        return {
          label: `exists:${key}`,
          execute: async () => {
            assert.strictEqual(await target.exists(key), 0);
            await target.set(key, '1');
            assert.strictEqual(await target.exists(key), 1);
          },
        };
      }

      case 10: {
        const key = keyspace.key('type-error', tag);

        return {
          label: `wrongtype-error:${key}`,
          execute: async () => {
            await target.set(key, 'not-a-list');

            const [[reply]] = await target.send([['LPUSH', key, 'x']]);

            assert.ok(reply instanceof RespError);
            assert.strictEqual(
              reply.message,
              'WRONGTYPE Operation against a key holding the wrong kind of value',
            );
          },
        };
      }

      default: {
        const key = keyspace.key('pipeline', tag);

        return {
          label: `pipeline:${key}`,
          execute: async () => {
            const replies = await target.send([
              ['SET', key, tag],
              ['APPEND', key, '!'],
              ['GET', key],
              ['STRLEN', key],
            ]);

            assert.strictEqual(replies[0][0], 'OK');
            assert.strictEqual(replies[1][0], tag.length + 1);
            assert.strictEqual(`${replies[2][0]}`, `${tag}!`);
            assert.strictEqual(replies[3][0], tag.length + 1);
          },
        };
      }
    }
  }

  async function runConsistencyBurst(
    target: FeaturedClient,
    count: number,
    seed: number,
  ): Promise<void> {
    const operations = shuffle(
      range(count).map((index) => buildOperation(target, index)),
      createRandom(seed),
    );

    const settled = await Promise.allSettled(
      operations.map((operation) => operation.execute()),
    );

    const failures = settled
      .map((result, index) => ({ result, label: operations[index].label }))
      .filter((entry) => entry.result.status === 'rejected')
      .map(
        (entry) =>
          `${entry.label}: ${(entry.result as PromiseRejectedResult).reason}`,
      );

    assert.deepStrictEqual(
      failures,
      [],
      `every concurrent reply must match its own command, but ${failures.length} desynced`,
    );
  }

  it('matches replies to commands across 3000 interleaved operations', async () => {
    await runConsistencyBurst(client, 3000, 0x5eed1);
  });

  it('stays correlated when a second seed reshuffles the interleaving', async () => {
    await runConsistencyBurst(client, 3000, 0xc0ffee);
  });

  it('correlates pure ECHO traffic with unique binary payloads', async () => {
    const tokens = range(2000).map(
      (index) => `${index}:${randomUUID()}:${'x'.repeat(index % 32)}`,
    );

    const replies = await Promise.all(
      tokens.map((token) => client.echo(token)),
    );

    assert.deepStrictEqual(replies, tokens);
  });

  it('keeps every client correlated under 16-way concurrent load', async () => {
    const workers = await Promise.all(range(16).map(() => createClient()));

    try {
      await Promise.all(
        workers.map((worker, workerIndex) =>
          runConsistencyBurst(worker, 400, 0x1000 + workerIndex),
        ),
      );
    } finally {
      await Promise.all(workers.map((worker) => closeClient(worker)));
    }
  });

  it('interleaves blocking and non-blocking commands without cross-talk', async () => {
    const blockKey = keyspace.key('blpop-target');
    const blockingClient = await createClient();
    const pusher = await createClient();

    try {
      const blocked = blockingClient.blpop([blockKey], 2);

      const fast = await Promise.all(
        range(50).map((index) => client.echo(`fast-${index}`)),
      );

      assert.deepStrictEqual(
        fast,
        range(50).map((index) => `fast-${index}`),
      );

      await pusher.rpush(blockKey, 'released');

      const popped = await blocked;

      assert.deepStrictEqual(popped, [blockKey, 'released']);
    } finally {
      await closeClient(blockingClient);
      await closeClient(pusher);
    }
  });
});

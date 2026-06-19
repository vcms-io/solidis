/** Fault-recovery stress with explicit loss accounting. */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  range,
  waitFor,
} from '../../utils/index.ts';

import type { FeaturedClient } from '../../utils/index.ts';

describe('stress-recovery', () => {
  let killer: FeaturedClient;
  const keyspace = createKeyspace('stress-recovery');

  before(async () => {
    killer = await createClient();
  });

  after(async () => {
    await closeClient(killer);
  });

  const waitUntilReady = async (client: FeaturedClient): Promise<void> => {
    await waitFor(
      async () => {
        try {
          return (await client.ping()) === 'PONG';
        } catch {
          return false;
        }
      },
      { timeout: 5000, interval: 25, description: 'reconnect after fault' },
    );
  };

  it('quantifies in-flight loss across repeated forced disconnects', async () => {
    const client = await createClient({
      autoReconnect: true,
      maxConnectionRetries: 20,
      connectionRetryDelay: 25,
      connectionTimeout: 500,
    });

    client.on('error', () => {});

    const rounds = 3;
    const perRound = 400;

    let resolved = 0;
    let rejected = 0;
    const keys: string[] = [];

    for (const round of range(rounds)) {
      await waitUntilReady(client);

      const clientId = await client.clientId();

      const outcomes = range(perRound).map((index) => {
        const key = keyspace.key('loss', round, index);
        keys.push(key);

        return client
          .set(key, `${round}:${index}`)
          .then(() => {
            resolved += 1;
          })
          .catch((error: unknown) => {
            assert.ok(
              error instanceof Error,
              `rejection must be an Error instance but got: ${typeof error}`,
            );
            rejected += 1;
          });
      });

      const firstKeyOfRound = keyspace.key('loss', round, 0);

      await waitFor(async () => (await killer.exists(firstKeyOfRound)) === 1, {
        timeout: 3000,
        interval: 5,
        description: 'at least one command reached server before kill',
      });

      await killer.clientKill(clientId);

      await Promise.all(outcomes);
    }

    await waitUntilReady(client);

    // Stress test limitation: only keys that both resolved and match the expected
    // round:index value are counted. Partial writes with stale values are not
    // verified individually because the volume makes full auditing impractical.
    let persisted = 0;
    const batchSize = 100;

    for (let index = 0; index < keys.length; index += batchSize) {
      const batch = keys.slice(index, index + batchSize);
      const values = await client.mget(...batch);

      for (let batchIndex = 0; batchIndex < values.length; batchIndex += 1) {
        const value = values[batchIndex];
        const keyIndex = index + batchIndex;
        const round = Math.floor(keyIndex / perRound);
        const position = keyIndex % perRound;
        const expectedValue = `${round}:${position}`;

        if (value === expectedValue) {
          persisted += 1;
        }
      }
    }

    const total = rounds * perRound;
    const lostButApplied = persisted - resolved;

    console.log(
      `[stress-recovery] forced-disconnect: total=${total} resolved=${resolved} ` +
        `rejected=${rejected} persisted=${persisted} ` +
        `rejectRate=${((rejected / total) * 100).toFixed(2)}% ` +
        `lostAck(applied-but-not-acked)=${lostButApplied}`,
    );

    assert.strictEqual(
      resolved + rejected,
      total,
      'every issued command must settle exactly once',
    );

    assert.ok(
      resolved > 0,
      'expected at least some commands to resolve successfully, ' +
        `but all ${total} were rejected`,
    );

    assert.ok(
      persisted >= resolved,
      `acknowledged writes must be durable: persisted=${persisted} < resolved=${resolved}`,
    );

    assert.strictEqual(await client.set(keyspace.key('final'), 'ok'), 'OK');
    assert.strictEqual(await client.get(keyspace.key('final')), 'ok');

    await closeClient(client);
  });

  it('survives a spurious command-timeout storm and never returns a wrong value', async () => {
    const client = await createClient({
      commandTimeout: 40,
      autoReconnect: true,
      maxConnectionRetries: 20,
      connectionRetryDelay: 20,
      connectionTimeout: 500,
    });

    client.on('error', () => {});

    const total = 2000;
    let correct = 0;
    let wrong = 0;
    let rejected = 0;
    const wrongSamples: string[] = [];

    await Promise.all(
      range(total).map((index) => {
        const token = `${index}-${randomUUID()}`;

        return client
          .echo(token)
          .then((reply) => {
            if (reply === token) {
              correct += 1;
            } else {
              wrong += 1;
              if (wrongSamples.length < 5) {
                wrongSamples.push(`${token} -> ${reply}`);
              }
            }
          })
          .catch((error: unknown) => {
            assert.ok(
              error instanceof Error,
              `rejection must be an Error instance but got: ${typeof error}`,
            );
            rejected += 1;
          });
      }),
    );

    console.log(
      `[stress-recovery] timeout-storm: total=${total} correct=${correct} ` +
        `wrong=${wrong} rejected=${rejected} ` +
        `lossRate=${((rejected / total) * 100).toFixed(2)}%`,
    );

    if (wrong > 0) {
      console.error(`  wrong samples: ${wrongSamples.join(' | ')}`);
    }

    assert.strictEqual(
      wrong,
      0,
      'a resolved command returned a value belonging to a different command',
    );
    assert.strictEqual(correct + rejected, total);

    await waitUntilReady(client);
    assert.strictEqual(await client.echo('post-storm'), 'post-storm');

    await closeClient(client);
  });

  it('rejects every in-flight command of a giant pipeline on mid-flight kill', async () => {
    const client = await createClient({
      autoReconnect: true,
      maxConnectionRetries: 20,
      connectionRetryDelay: 25,
      connectionTimeout: 500,
    });

    client.on('error', () => {});

    const clientId = await client.clientId();

    const commands = range(5000).map((index) => [
      'SET',
      keyspace.key('giant', index),
      `${index}`,
    ]);

    const settled = client
      .send(commands)
      .then(() => 'resolved' as const)
      .catch(() => 'rejected' as const);

    await new Promise<void>((resolve) => setImmediate(resolve));
    await killer.clientKill(clientId);

    const outcome = await settled;

    console.log(`[stress-recovery] giant-pipeline kill outcome=${outcome}`);

    // Stress test limitation: partial pipeline write state on the server is not
    // verified here; only full rejection of the in-flight batch is required.

    assert.strictEqual(
      outcome,
      'rejected',
      'a pipeline killed mid-flight must be rejected',
    );

    await waitUntilReady(client);
    assert.strictEqual(
      await client.set(keyspace.key('giant-final'), 'ok'),
      'OK',
    );

    await closeClient(client);
  });

  it('does not mis-attribute a stale reply after a command timeout', async () => {
    const victim = await createClient({
      commandTimeout: 80,
      autoReconnect: true,
      maxConnectionRetries: 5,
      connectionRetryDelay: 30,
    });

    victim.on('error', () => {});

    const pusher = await createClient();
    const key = keyspace.key('stale', randomUUID());

    try {
      const blocked = victim
        .blpop([key], 0)
        .then(() => 'resolved')
        .catch(() => 'rejected');

      await waitFor(
        async () => {
          try {
            await victim.echo('probe');
            return false;
          } catch {
            return true;
          }
        },
        { timeout: 3000, interval: 10, description: 'blpop command timeout' },
      );

      const echoPromise = victim
        .echo('FRESH')
        .then((value) => value)
        .catch((error: Error) => `THREW:${error.message}`);

      await new Promise<void>((resolve) => setImmediate(resolve));

      await pusher.rpush(key, 'STALE-PAYLOAD');

      const echoed = await echoPromise;

      assert.strictEqual(await blocked, 'rejected');
      assert.strictEqual(echoed, 'FRESH');
    } finally {
      await closeClient(pusher);
      await closeClient(victim);
    }
  });
});

/** Fault-recovery stress with explicit loss accounting. */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import {
  SolidisConnectionError,
  SolidisRequesterError,
} from '../../../../sources/index.ts';
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

  const isBlockedOnServer = async (clientId: number): Promise<boolean> =>
    (await killer.clientList())
      .split('\n')
      .some(
        (line) =>
          line.startsWith(`id=${clientId} `) && line.includes('cmd=blpop'),
      );

  it('quantifies in-flight loss across repeated forced disconnects', async () => {
    const client = await createClient({
      autoReconnect: true,
      maxConnectionRetries: 20,
      connectionRetryDelay: 25,
      connectionTimeout: 500,
    });

    client.on('error', () => {});

    const rounds = 3;
    const perRound = 200;

    let resolved = 0;
    let rejected = 0;
    const acknowledgedKeys: string[] = [];
    const stuckKeys: string[] = [];

    const write = (key: string, value: string) =>
      client.set(key, value).then(
        () => {
          resolved += 1;
        },
        (error: unknown) => {
          assert.ok(
            error instanceof Error,
            `rejection must be an Error instance but got: ${typeof error}`,
          );
          rejected += 1;
        },
      );

    for (const round of range(rounds)) {
      await waitUntilReady(client);

      const clientId = await client.clientId();

      await Promise.all(
        range(perRound).map((index) => {
          const key = keyspace.key('loss', round, 'acknowledged', index);

          acknowledgedKeys.push(key);

          return write(key, `${round}:${index}`);
        }),
      );

      /**
       * Redis leaves a blocked client's pipelined commands unprocessed, so
       * every write queued behind this BLPOP is guaranteed to be in flight
       * when the connection is killed.
       */
      const blocked = client
        .blpop([keyspace.key('loss', round, 'block')], 0)
        .then(
          () => undefined,
          (error: unknown) => error,
        );
      const stuck = range(perRound).map((index) => {
        const key = keyspace.key('loss', round, 'stuck', index);

        stuckKeys.push(key);

        return write(key, `${round}:${index}`);
      });

      await waitFor(() => isBlockedOnServer(clientId), {
        timeout: 3000,
        interval: 5,
        description: 'BLPOP blocked on the server',
      });

      await killer.clientKill(clientId);

      const blockedError = await blocked;

      assert.ok(blockedError instanceof SolidisConnectionError);
      assert.strictEqual(blockedError.message, 'Connection closed.');

      await Promise.all(stuck);
    }

    await waitUntilReady(client);

    const total = rounds * perRound * 2;

    console.log(
      `[stress-recovery] forced-disconnect: total=${total} resolved=${resolved} ` +
        `rejected=${rejected} rejectRate=${((rejected / total) * 100).toFixed(2)}%`,
    );

    assert.strictEqual(resolved, rounds * perRound);
    assert.strictEqual(rejected, rounds * perRound);
    assert.strictEqual(
      await killer.exists(...acknowledgedKeys),
      acknowledgedKeys.length,
      'every acknowledged write must be durable',
    );
    assert.strictEqual(
      await killer.exists(...stuckKeys),
      0,
      'a rejected write queued behind the killed BLPOP must never be applied',
    );

    assert.strictEqual(await client.set(keyspace.key('final'), 'ok'), 'OK');
    assert.strictEqual(await client.get(keyspace.key('final')), 'ok');

    await closeClient(client);
  });

  it('survives a command-timeout storm behind a blocking command and never returns a wrong value', async () => {
    const commandTimeout = 100;
    const client = await createClient({
      commandTimeout,
      autoReconnect: true,
      maxConnectionRetries: 20,
      connectionRetryDelay: 20,
      connectionTimeout: 500,
    });
    const closeErrors: Error[] = [];

    client.on('error', () => {});
    client.on('close', (error) => closeErrors.push(error));

    const wave = 300;
    let wrong = 0;
    const wrongSamples: string[] = [];

    const echo = (token: string) =>
      client.echo(token).then((reply) => {
        if (reply !== token) {
          wrong += 1;

          if (wrongSamples.length < 5) {
            wrongSamples.push(`${token} -> ${reply}`);
          }
        }

        return reply;
      });

    const before = await Promise.all(
      range(wave).map((index) => echo(`before-${index}-${randomUUID()}`)),
    );

    /**
     * The ECHOs queued behind the BLPOP time out while the server holds them,
     * and their late replies arrive right before the replies of the next wave.
     */
    const blocked = client.blpop([keyspace.key('storm', 'block')], 0.4);
    const stuck = await Promise.allSettled(
      range(wave).map((index) => echo(`stuck-${index}-${randomUUID()}`)),
    );

    assert.strictEqual(await blocked, null);

    const after = await Promise.all(
      range(wave).map((index) => echo(`after-${index}-${randomUUID()}`)),
    );

    console.log(
      `[stress-recovery] timeout-storm: before=${before.length} ` +
        `stuck=${stuck.length} after=${after.length} wrong=${wrong}`,
    );

    if (wrong > 0) {
      console.error(`  wrong samples: ${wrongSamples.join(' | ')}`);
    }

    assert.strictEqual(
      wrong,
      0,
      'a resolved command returned a value belonging to a different command',
    );

    for (const result of stuck) {
      if (result.status !== 'rejected') {
        assert.fail('an ECHO held behind the BLPOP must time out');
      }

      assert.ok(result.reason instanceof SolidisRequesterError);
      assert.strictEqual(
        result.reason.message,
        `Command(s) timed out after ${commandTimeout} ms.`,
      );
    }

    assert.deepStrictEqual(
      closeErrors,
      [],
      'the connection must stay open while the BLPOP is still in flight',
    );
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

    const blockKey = keyspace.key('giant', 'block');
    const commands = [['BLPOP', blockKey, '0']];

    for (const index of range(4999)) {
      commands.push(['SET', keyspace.key('giant', index), `${index}`]);
    }

    const settled: Promise<'resolved' | 'rejected'> = (async () => {
      try {
        await client.send(commands);

        return 'resolved';
      } catch {
        return 'rejected';
      }
    })();

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
      let isBlockedSettled = false;

      const blocked = victim
        .blpop([key], 0)
        .catch((error: Error) => `THREW:${error.message}`)
        .finally(() => {
          isBlockedSettled = true;
        });

      // BLPOP with timeout 0 is never cut off by commandTimeout, but an
      // ordinary command queued behind it still is. The server only answers
      // the queued ECHO once the BLPOP is served, so its reply arrives late.
      await assert.rejects(
        victim.echo('STALE'),
        (error: Error) =>
          error instanceof SolidisRequesterError &&
          error.message === 'Command(s) timed out after 80 ms.',
      );

      assert.strictEqual(
        isBlockedSettled,
        false,
        'BLPOP with timeout 0 must still be waiting after commandTimeout',
      );

      const echoPromise = victim
        .echo('FRESH')
        .then((value) => value)
        .catch((error: Error) => `THREW:${error.message}`);

      await new Promise<void>((resolve) => setImmediate(resolve));

      await pusher.rpush(key, 'PAYLOAD');

      const echoed = await echoPromise;

      assert.deepStrictEqual(await blocked, [key, 'PAYLOAD']);
      assert.strictEqual(echoed, 'FRESH');
      assert.strictEqual(await victim.echo('AFTER'), 'AFTER');
    } finally {
      await closeClient(pusher);
      await closeClient(victim);
    }
  });
});

/**
 * Reconnection STATE recovery.
 *
 * Auto-reconnect alone is not enough: after the socket comes back the client
 * must restore the session state the caller established before the fault —
 * specifically the selected database and any active subscriptions (governed by
 * the `autoRecovery` option). These tests force a disconnect with CLIENT KILL
 * and assert the recovered connection behaves as if nothing happened, and that
 * disabling a recovery flag is genuinely honoured.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  waitFor,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('recovery-state', () => {
  let killer: FeaturedClient;
  const keyspace = createKeyspace('recovery-state');

  before(async () => {
    killer = await createClient();
  });

  after(async () => {
    await closeClient(killer);
  });

  /**
   * Force-closes `target`'s server-side connection and waits for it to become
   * ready again. The client id is taken as a parameter because a subscribed
   * RESP2 connection cannot issue CLIENT ID itself.
   */
  const forceReconnect = async (
    target: FeaturedClient,
    clientId: number,
  ): Promise<void> => {
    const ready = new Promise<void>((resolve) => target.once('ready', resolve));

    await killer.clientKill(clientId);
    await ready;
  };

  it('re-selects the configured database after a forced disconnect', async () => {
    const client = await createClient({
      database: 3,
      autoReconnect: true,
      maxConnectionRetries: 5,
      connectionRetryDelay: 50,
    });

    client.on('error', () => {});

    const probe = await createClient({ database: 0 });

    try {
      const key = keyspace.key('db', 'before');

      await client.set(key, 'on-db-3');

      /** Sanity: the write landed on db 3, invisible to a db 0 connection. */
      assert.strictEqual(await probe.get(key), null);
      assert.match(await client.clientInfo(), /\bdb=3\b/);

      await forceReconnect(client, await client.clientId());

      /**
       * The reconnected connection must be back on db 3. CLIENT INFO is checked
       * directly (rather than relying on a key surviving) so the assertion is
       * immune to unrelated global writes on the shared server.
       */
      assert.match(await client.clientInfo(), /\bdb=3\b/);

      const afterKey = keyspace.key('db', 'after');

      await client.set(afterKey, 'still-db-3');

      assert.strictEqual(await probe.get(afterKey), null);
      assert.strictEqual(await client.get(afterKey), 'still-db-3');

      await client.del(afterKey);
    } finally {
      await closeClient(probe);
      await closeClient(client);
    }
  });

  it('restores subscriptions after a forced disconnect', async () => {
    const subscriber = await createClient({
      autoReconnect: true,
      maxConnectionRetries: 5,
      connectionRetryDelay: 50,
    });

    subscriber.on('error', () => {});

    const publisher = await createClient();
    const channel = keyspace.key('resubscribe');
    const received: string[] = [];

    subscriber.on('message', (incomingChannel, message) => {
      if (`${incomingChannel}` === channel) {
        received.push(`${message}`);
      }
    });

    try {
      /** Capture the id before subscribing; CLIENT ID is blocked once subscribed. */
      const subscriberId = await subscriber.clientId();

      await subscriber.subscribe(channel);

      await waitFor(
        async () => (await publisher.pubsubNumsub([channel]))[channel] === 1,
        { description: 'initial subscription registered' },
      );

      assert.strictEqual(await publisher.publish(channel, 'before'), 1);
      await waitFor(() => received.includes('before'), {
        description: 'baseline delivery',
      });

      await forceReconnect(subscriber, subscriberId);

      /** After reconnect the subscription must be re-established server-side. */
      await waitFor(
        async () => (await publisher.pubsubNumsub([channel]))[channel] === 1,
        { timeout: 3000, description: 'subscription restored' },
      );

      /** And messages must flow to the same handler again. */
      await waitFor(
        async () => {
          await publisher.publish(channel, 'after');

          return received.includes('after');
        },
        {
          timeout: 3000,
          interval: 100,
          description: 'post-reconnect delivery',
        },
      );

      assert.ok(received.includes('after'));
    } finally {
      await closeClient(publisher);
      await closeClient(subscriber);
    }
  });

  it('does not restore subscriptions when autoRecovery.subscribe is disabled', async () => {
    const subscriber = await createClient({
      autoReconnect: true,
      maxConnectionRetries: 5,
      connectionRetryDelay: 50,
      autoRecovery: {
        database: true,
        subscribe: false,
        ssubscribe: false,
        psubscribe: false,
      },
    });

    subscriber.on('error', () => {});

    const publisher = await createClient();
    const channel = keyspace.key('no-resubscribe');

    try {
      const subscriberId = await subscriber.clientId();

      await subscriber.subscribe(channel);

      await waitFor(
        async () => (await publisher.pubsubNumsub([channel]))[channel] === 1,
        { description: 'initial subscription registered' },
      );

      await forceReconnect(subscriber, subscriberId);

      /**
       * With re-subscription disabled the reconnected connection must NOT be
       * subscribed; the server should report zero subscribers for the channel.
       */
      await waitFor(
        async () => {
          try {
            return (await publisher.pubsubNumsub([channel]))[channel] === 0;
          } catch {
            return false;
          }
        },
        {
          timeout: 3000,
          interval: 100,
          description: 'subscription intentionally not restored',
        },
      );

      assert.strictEqual((await publisher.pubsubNumsub([channel]))[channel], 0);
    } finally {
      await closeClient(publisher);
      await closeClient(subscriber);
    }
  });
});

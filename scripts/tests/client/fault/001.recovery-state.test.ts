/** Reconnection state recovery: database re-selection and subscription restoration. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  waitFor,
} from '../../utils/index.ts';

import type { FeaturedClient } from '../../utils/index.ts';

describe('recovery-state', () => {
  let killer: FeaturedClient;
  const keyspace = createKeyspace('recovery-state');

  before(async () => {
    killer = await createClient();
  });

  after(async () => {
    await closeClient(killer);
  });

  const parseClientInfoField = (
    clientInfo: string,
    fieldName: string,
  ): string | undefined => {
    for (const token of clientInfo.split(' ')) {
      const separatorIndex = token.indexOf('=');

      if (separatorIndex === -1) {
        continue;
      }

      if (token.slice(0, separatorIndex) === fieldName) {
        return token.slice(separatorIndex + 1);
      }
    }

    return undefined;
  };

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
      connectionRetryDelay: 25,
      connectionTimeout: 500,
    });

    client.on('error', () => {});

    const probe = await createClient({ database: 0 });

    try {
      const key = keyspace.key('db', 'before');

      assert.strictEqual(await client.set(key, 'on-db-3'), 'OK');

      assert.strictEqual(await probe.get(key), null);
      assert.strictEqual(
        parseClientInfoField(await client.clientInfo(), 'db'),
        '3',
      );

      await forceReconnect(client, await client.clientId());

      assert.strictEqual(
        parseClientInfoField(await client.clientInfo(), 'db'),
        '3',
      );

      const afterKey = keyspace.key('db', 'after');

      assert.strictEqual(await client.set(afterKey, 'still-db-3'), 'OK');

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
      connectionRetryDelay: 25,
      connectionTimeout: 500,
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

      await waitFor(
        async () => (await publisher.pubsubNumsub([channel]))[channel] === 1,
        { timeout: 3000, description: 'subscription restored' },
      );

      assert.strictEqual(
        await publisher.publish(channel, 'after'),
        1,
        'PUBLISH must reach exactly 1 subscriber after subscription restoration',
      );

      await waitFor(() => received.includes('after'), {
        timeout: 3000,
        interval: 50,
        description: 'post-reconnect delivery',
      });

      assert.deepStrictEqual(received, ['before', 'after']);
    } finally {
      await closeClient(publisher);
      await closeClient(subscriber);
    }
  });

  it('does not restore subscriptions when autoRecovery.subscribe is disabled', async () => {
    const subscriber = await createClient({
      autoReconnect: true,
      maxConnectionRetries: 5,
      connectionRetryDelay: 25,
      connectionTimeout: 500,
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
      assert.strictEqual(await publisher.publish(channel, 'after-disabled'), 0);
    } finally {
      await closeClient(publisher);
      await closeClient(subscriber);
    }
  });
});

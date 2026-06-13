/**
 * Connection / client lifecycle edge branches.
 *
 * Targets the less-travelled paths in the connection and client modules: the
 * TLS socket constructor, RESP3 negotiation, lazy connect, the
 * autoReconnect-disabled close path, repeated (idempotent) fault recovery, and
 * the debug wiring. These are the branches that ordinary command tests never
 * reach.
 */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../sources/client/featured.ts';
import {
  SolidisClientError,
  SolidisConnectionError,
} from '../../../sources/index.ts';
import {
  buildClientOptions,
  closeClient,
  createClient,
  delay,
  waitFor,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('lifecycle-edge', () => {
  const tracked: FeaturedClient[] = [];

  const track = (client: FeaturedClient): FeaturedClient => {
    tracked.push(client);
    return client;
  };

  after(async () => {
    await Promise.all(tracked.map((client) => closeClient(client)));
  });

  it('negotiates RESP3 and round-trips typed replies', async () => {
    const client = track(await createClient({ protocol: 'RESP3' }));

    assert.strictEqual(await client.ping(), 'PONG');

    const key = `solidis:test:resp3:${Date.now()}`;
    await client.hset(key, 'a', '1');

    /** RESP3 returns a map for HGETALL; the client normalises it to an object. */
    const all = await client.hgetall(key);
    assert.strictEqual(all.a, '1');

    await client.del(key);
  });

  it('drives the TLS socket constructor (handshake fails against a plain server)', async () => {
    const client = new SolidisFeaturedClient(
      buildClientOptions({
        useTLS: true,
        lazyConnect: true,
        connectionTimeout: 1500,
        maxConnectionRetries: 0,
      }),
    );

    client.on('error', () => {});

    /** The point is to exercise tls.connect(); the handshake is expected to fail. */
    await assert.rejects(
      () => client.connect(),
      (error: Error) =>
        error instanceof SolidisClientError ||
        error instanceof SolidisConnectionError,
    );

    client.quit();
  });

  it('connects lazily only when the first command is issued', async () => {
    const client = track(
      new SolidisFeaturedClient(buildClientOptions({ lazyConnect: true })),
    );

    client.on('error', () => {});

    /** No eager connection; the command itself triggers connect(). */
    assert.strictEqual(await client.ping(), 'PONG');
  });

  it('does not reconnect after a kill when autoReconnect is disabled', async () => {
    const client = track(
      await createClient({ autoReconnect: false, maxConnectionRetries: 0 }),
    );

    client.on('error', () => {});

    const key = `solidis:test:noreconnect:${Date.now()}`;
    await client.set(key, 'v');

    const clientId = await client.clientId();
    const killer = track(await createClient());

    /**
     * Killing the connection drives the close handler's autoReconnect-disabled
     * branch (it emits 'closed' and returns without scheduling a reconnect).
     */
    await killer.clientKill(clientId);
    await delay(150);

    /**
     * With autoReconnect off the socket stays down until a command forces a
     * manual reconnect via connect(); the client then recovers on demand and
     * the previously written value is still durable.
     */
    assert.strictEqual(await client.get(key), 'v');
  });

  it('survives rapid repeated disconnects (idempotent recovery)', async () => {
    const client = track(
      await createClient({
        autoReconnect: true,
        maxConnectionRetries: 10,
        connectionRetryDelay: 25,
      }),
    );

    client.on('error', () => {});

    const key = `solidis:test:rapidkill:${Date.now()}`;
    await client.set(key, 'stable');

    const killer = track(await createClient());

    /** Two kills in quick succession drive the recovery guard's early return. */
    for (let round = 0; round < 3; round += 1) {
      const id = await client.clientId().catch(() => null);

      if (id !== null) {
        await killer.clientKill(id).catch(() => {});
        await killer.clientKill(id).catch(() => {});
      }

      await waitFor(
        async () => {
          try {
            return (await client.ping()) === 'PONG';
          } catch {
            return false;
          }
        },
        { timeout: 3000, interval: 25, description: 'recovered' },
      );
    }

    assert.strictEqual(await client.get(key), 'stable');
  });

  it('streams debug entries and survives a debug-enabled command flow', async () => {
    const client = track(
      await createClient({ debug: true, debugMaxEntries: 64 }),
    );

    const entries: unknown[] = [];
    client.on('debug', (entry) => entries.push(entry));

    await client.set(`solidis:test:debug:${Date.now()}`, 'v');
    await client.ping();

    await waitFor(() => entries.length > 0, {
      timeout: 1000,
      description: 'debug entries emitted',
    });

    assert.ok(entries.length > 0);
  });
});

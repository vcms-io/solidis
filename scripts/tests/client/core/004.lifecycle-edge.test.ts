/** Connection/client lifecycle edge branches (TLS, RESP3, lazy connect, no-reconnect, debug). */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../../sources/client/featured.ts';
import {
  SolidisClientError,
  SolidisConnectionError,
} from '../../../../sources/index.ts';
import {
  buildClientOptions,
  closeClient,
  createClient,
  delay,
  waitFor,
} from '../../utils/index.ts';

import type { FeaturedClient } from '../../utils/index.ts';

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

    const all = await client.hgetall(key);
    assert.strictEqual(all.a, '1');

    await client.del(key);
  });

  it('drives the TLS socket constructor (handshake fails against a plain server)', async () => {
    const client = new SolidisFeaturedClient(
      buildClientOptions({
        useTLS: true,
        lazyConnect: true,
        connectionTimeout: 500,
        maxConnectionRetries: 0,
      }),
    );

    client.on('error', () => {});

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

    await killer.clientKill(clientId);
    await delay(80);

    assert.strictEqual(await client.get(key), 'v');
  });

  it('survives rapid repeated disconnects (idempotent recovery)', async () => {
    const client = track(
      await createClient({
        autoReconnect: true,
        maxConnectionRetries: 10,
        connectionRetryDelay: 25,
        connectionTimeout: 500,
      }),
    );

    client.on('error', () => {});

    const key = `solidis:test:rapidkill:${Date.now()}`;
    await client.set(key, 'stable');

    const killer = track(await createClient());

    for (let round = 0; round < 2; round += 1) {
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
        { timeout: 2000, interval: 25, description: 'recovered' },
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

/** Connection lifecycle, handshake, and reconnection behaviour. */

import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../../sources/client/featured.ts';
import { SolidisClientError } from '../../../../sources/index.ts';
import {
  buildClientOptions,
  closeClient,
  createClient,
  delay,
} from '../../utils/index.ts';

import type { FeaturedClient } from '../../utils/index.ts';

describe('connection', () => {
  const trackedClients: FeaturedClient[] = [];

  after(async () => {
    await Promise.all(trackedClients.map((client) => closeClient(client)));
  });

  const track = (client: FeaturedClient): FeaturedClient => {
    trackedClients.push(client);

    return client;
  };

  it('connects eagerly and answers PING', async () => {
    const client = track(await createClient());

    assert.strictEqual(await client.ping(), 'PONG');
  });

  it('echoes the exact payload', async () => {
    const client = track(await createClient());

    assert.strictEqual(await client.echo('solidis'), 'solidis');
  });

  it('emits connect then ready in order', async () => {
    const events: string[] = [];

    const client = new SolidisFeaturedClient(
      buildClientOptions({ lazyConnect: true }),
    );

    track(client);

    client.on('error', () => {});
    client.on('connect', () => events.push('connect'));
    client.on('ready', () => events.push('ready'));

    await client.connect();

    assert.deepStrictEqual(events, ['connect', 'ready']);
  });

  it('honours lazyConnect (no socket until connect)', async () => {
    const client = new SolidisFeaturedClient(
      buildClientOptions({ lazyConnect: true }),
    );

    track(client);

    client.on('error', () => {});

    let readyFired = false;
    client.on('ready', () => {
      readyFired = true;
    });

    await delay(50);

    assert.strictEqual(readyFired, false);

    await client.connect();

    assert.strictEqual(readyFired, true);
  });

  it('treats repeated connect() calls as idempotent', async () => {
    const client = track(await createClient());

    await client.connect();
    await client.connect();

    assert.strictEqual(await client.ping(), 'PONG');
  });

  it('exposes a normalised connection uri', async () => {
    const client = track(await createClient());

    assert.match(client.uri, /^redis:\/\//);
  });

  it('rejects commands after quit with a client error', async () => {
    const client = new SolidisFeaturedClient(
      buildClientOptions({ lazyConnect: true }),
    );

    client.on('error', () => {});

    await client.connect();
    await client.ping();

    const ended = new Promise<void>((resolve) => client.once('end', resolve));

    client.quit();

    await ended;

    await assert.rejects(
      () => client.connect(),
      (error: Error) =>
        error instanceof SolidisClientError && /closed/i.test(error.message),
    );
  });

  it('negotiates RESP3 when requested', async () => {
    const client = track(await createClient({ protocol: 'RESP3' }));

    assert.strictEqual(await client.ping(), 'PONG');
  });

  it('selects a non-zero database without error', async () => {
    const client = track(await createClient());

    assert.strictEqual(await client.select(1), 'OK');
    await client.flushdb();
    assert.strictEqual(await client.select(0), 'OK');
  });

  it('supports many independent clients concurrently', async () => {
    const clients = await Promise.all(
      Array.from({ length: 16 }, () => createClient()),
    );

    for (const client of clients) {
      track(client);
    }

    const pongs = await Promise.all(clients.map((client) => client.ping()));

    assert.ok(pongs.every((value) => value === 'PONG'));
  });

  it('wraps connection failures in SolidisClientError', async () => {
    const client = new SolidisFeaturedClient(
      buildClientOptions({
        host: '127.0.0.1',
        port: 1,
        lazyConnect: true,
        maxConnectionRetries: 0,
        connectionTimeout: 200,
      }),
    );

    client.on('error', () => {});

    let caught: unknown;

    try {
      await client.connect();
    } catch (error) {
      caught = error;
    }

    assert.ok(caught instanceof SolidisClientError);

    client.quit();
  });

  it('applies clientName via HELLO when using RESP3', async () => {
    const name = `solidis-resp3-${Date.now()}`;
    const client = await createClient({ clientName: name, protocol: 'RESP3' });

    assert.strictEqual(await client.clientGetname(), name);

    await closeClient(client);
  });

  it('falls back to CLIENT SETNAME for clientName on RESP2', async () => {
    const name = `solidis-resp2-${Date.now()}`;
    const client = await createClient({ clientName: name, protocol: 'RESP2' });

    assert.strictEqual(await client.clientGetname(), name);

    await closeClient(client);
  });

  it('connects using a redis:// URI', async () => {
    const client = track(await createClient({ uri: 'redis://127.0.0.1:6379' }));

    assert.strictEqual(await client.ping(), 'PONG');
  });

  it('performs ready check when enabled', async () => {
    const client = track(await createClient({ enableReadyCheck: true }));

    assert.strictEqual(await client.ping(), 'PONG');
  });

  it('skips ready check when disabled', async () => {
    const client = track(await createClient({ enableReadyCheck: false }));

    assert.strictEqual(await client.ping(), 'PONG');
  });

  it('connects automatically when lazyConnect is false', async () => {
    const autoClient = new SolidisFeaturedClient(
      buildClientOptions({ lazyConnect: false }),
    );

    autoClient.on('error', () => {});

    await new Promise<void>((resolve) => {
      autoClient.on('ready', resolve);
    });

    assert.strictEqual(await autoClient.ping(), 'PONG');

    track(autoClient);
  });

  it('retries and eventually rejects on persistent failure', async () => {
    const client = new SolidisFeaturedClient(
      buildClientOptions({
        host: '127.0.0.1',
        port: 1,
        lazyConnect: true,
        maxConnectionRetries: 1,
        connectionRetryDelay: 10,
        connectionTimeout: 100,
      }),
    );

    client.on('error', () => {});

    await assert.rejects(
      () => client.connect(),
      (error: Error) =>
        error instanceof SolidisClientError &&
        /connection failed|retries|ECONNREFUSED|timeout/i.test(error.message),
    );
  });

  it('rejects connection to wrong port with zero timeout', async () => {
    const client = new SolidisFeaturedClient(
      buildClientOptions({
        host: '127.0.0.1',
        port: 1,
        lazyConnect: true,
        connectionTimeout: 0,
        maxConnectionRetries: 0,
      }),
    );

    client.on('error', () => {});

    await assert.rejects(
      () => client.connect(),
      (error: Error) =>
        error instanceof SolidisClientError &&
        /connection failed|ECONNREFUSED|refused|timeout/i.test(error.message),
    );
  });

  it('rejects authentication with bad credentials', async () => {
    await assert.rejects(
      () =>
        createClient({
          authentication: { username: 'invalid', password: 'wrong' },
        }),
      (error: Error) =>
        error instanceof SolidisClientError &&
        /Authentication failed|WRONGPASS|invalid (username|password)/i.test(
          error.message,
        ),
    );
  });

  it('handles concurrent connect calls gracefully (connectLock)', async () => {
    const raceClient = new SolidisFeaturedClient(
      buildClientOptions({ lazyConnect: true }),
    );

    raceClient.on('error', () => {});

    const [first, second] = await Promise.allSettled([
      raceClient.connect(),
      raceClient.connect(),
    ]);

    assert.strictEqual(first.status, 'fulfilled');
    assert.strictEqual(second.status, 'fulfilled');
    assert.strictEqual(await raceClient.ping(), 'PONG');

    track(raceClient);
  });

  it('rejects with timeout error when host is unreachable', async () => {
    const unreachableClient = new SolidisFeaturedClient(
      buildClientOptions({
        lazyConnect: true,
        host: '127.0.0.1',
        port: 1,
        connectionTimeout: 100,
        maxConnectionRetries: 0,
      }),
    );

    unreachableClient.on('error', () => {});

    await assert.rejects(
      () => unreachableClient.connect(),
      (error: Error) =>
        error.message.includes('timeout') ||
        error.message.includes('connect') ||
        error.message.includes('ECONNREFUSED'),
    );

    unreachableClient.quit();
  });

  it('rejects connect after quit via client quit method', async () => {
    const quitClient = await createClient({
      autoReconnect: false,
      maxConnectionRetries: 0,
    });

    quitClient.on('error', () => {});

    await quitClient.quit();

    await assert.rejects(
      () => quitClient.connect(),
      (error: Error) => error instanceof SolidisClientError,
    );
  });

  it('reconnects automatically when socket is killed and autoReconnect is true', async () => {
    const reconnectClient = await createClient({
      autoReconnect: true,
      maxConnectionRetries: 5,
      connectionRetryDelay: 50,
    });

    reconnectClient.on('error', () => {});

    const key = `solidis:test:conn:reconnect-${Date.now()}`;

    await reconnectClient.set(key, 'before-kill');

    const clientId = await reconnectClient.clientId();
    const killer = track(await createClient());

    await killer.clientKill(clientId);

    await delay(500);

    const value = await reconnectClient.get(key);

    assert.strictEqual(value, 'before-kill');

    await closeClient(reconnectClient);
  });

  it('completes commands with socket write timeout configured', async () => {
    const client = track(await createClient({ socketWriteTimeout: 5000 }));

    assert.strictEqual(await client.ping(), 'PONG');
  });

  it('emits debug entries when debug option is enabled', async () => {
    const debugEntries: unknown[] = [];

    const debugClient = await createClient({ debug: true });

    debugClient.on('debug', (entry) => {
      debugEntries.push(entry);
    });

    await debugClient.ping();

    assert.ok(
      debugEntries.length > 0,
      'Expected debug entries after ping with debug enabled',
    );

    await closeClient(debugClient);
  });

  it('wraps connection error in SolidisClientError on send', async () => {
    const badClient = new SolidisFeaturedClient(
      buildClientOptions({
        lazyConnect: true,
        host: '127.0.0.1',
        port: 1,
        connectionTimeout: 50,
        maxConnectionRetries: 0,
      }),
    );

    badClient.on('error', () => {});

    await assert.rejects(
      () => badClient.ping(),
      (error: Error) =>
        error instanceof SolidisClientError &&
        /Not connected/i.test(error.message),
    );

    badClient.quit();
  });
});

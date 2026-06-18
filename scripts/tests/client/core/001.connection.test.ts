/** Connection lifecycle, handshake, and reconnection behaviour. */

import assert from 'node:assert/strict';
import net from 'node:net';
import { after, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../../sources/client/featured.ts';
import { SolidisDefaultOptions } from '../../../../sources/common/constants.ts';
import {
  SolidisClientError,
  SolidisConnectionError,
} from '../../../../sources/index.ts';
import { SolidisConnection } from '../../../../sources/modules/connection.ts';
import { SolidisDebugMemory } from '../../../../sources/modules/debug.ts';
import {
  buildClientOptions,
  closeClient,
  createClient,
  MockRedisServer,
  resolveConnectionTarget,
  waitFor,
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

    await new Promise<void>((resolve) => setImmediate(resolve));

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
    const target = resolveConnectionTarget();

    assert.strictEqual(client.uri, `redis://${target.host}:${target.port}`);
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
        error instanceof SolidisClientError &&
        error.message === 'Cannot connect after the client was closed.',
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

    assert.deepStrictEqual(
      pongs,
      Array.from({ length: 16 }, () => 'PONG'),
    );
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

  it('accepts enableReadyCheck in both states without error', async () => {
    const enabled = track(await createClient({ enableReadyCheck: true }));

    assert.strictEqual(await enabled.ping(), 'PONG');

    const disabled = track(await createClient({ enableReadyCheck: false }));

    assert.strictEqual(await disabled.ping(), 'PONG');
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
        error.message ===
          'SolidisConnectionError: Error: connect ECONNREFUSED 127.0.0.1:1',
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
        error.message ===
          'SolidisConnectionError: Error: connect ECONNREFUSED 127.0.0.1:1',
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
        error.message === 'Authentication failed',
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

  it('rejects with a connection error when host is unreachable', async () => {
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
        error instanceof SolidisClientError &&
        error.message ===
          'SolidisConnectionError: Error: connect ECONNREFUSED 127.0.0.1:1',
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
      (error: Error) =>
        error instanceof SolidisClientError &&
        error.message === 'Cannot connect after the client was closed.',
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

    await waitFor(
      async () => {
        try {
          return (await reconnectClient.ping()) === 'PONG';
        } catch {
          return false;
        }
      },
      { timeout: 3000, interval: 25, description: 'reconnect after kill' },
    );

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

    assert.strictEqual(await debugClient.ping(), 'PONG');

    const pingDebugEntry = debugEntries.find(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        'message' in entry &&
        entry.message ===
          'Solidis requester serialized command: *1\r\n$4\r\nPING\r\n',
    );

    assert.ok(
      pingDebugEntry,
      'Expected a PING command debug entry after ping with debug enabled',
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
        error.message === 'Not connected with redis server.',
    );

    badClient.quit();
  });

  describe('SolidisConnection transport', () => {
    it('throws when connect follows quit on the transport layer', async () => {
      const server = new MockRedisServer();
      await server.listen();

      const connection = new SolidisConnection({
        ...SolidisDefaultOptions,
        host: '127.0.0.1',
        port: server.port,
        clientName: '',
        enableReadyCheck: false,
        autoReconnect: false,
        maxConnectionRetries: 0,
      });

      connection.on('error', () => {});

      await connection.connect();
      connection.quit();

      await assert.rejects(
        () => connection.connect(),
        (error: Error) =>
          error instanceof SolidisConnectionError &&
          error.message === 'Cannot connect because user quit the connection.',
      );

      await server.close();
    });

    it('returns immediately when connect is called on an established transport', async () => {
      const server = new MockRedisServer();
      await server.listen();

      const connection = new SolidisConnection({
        ...SolidisDefaultOptions,
        host: '127.0.0.1',
        port: server.port,
        clientName: '',
        enableReadyCheck: false,
        autoReconnect: false,
      });

      connection.on('error', () => {});

      let connectEventCount = 0;

      connection.on('connect', () => {
        connectEventCount += 1;
      });

      await connection.connect();

      assert.strictEqual(connectEventCount, 1);

      await connection.connect();

      assert.strictEqual(
        connectEventCount,
        1,
        'a duplicate connect() must be a no-op and must not emit connect again',
      );

      connection.quit();
      await server.close();
    });

    it('cleans up the previous socket when a connection retry begins', async () => {
      let acceptCount = 0;
      let server: net.Server;

      const listen = (): Promise<number> =>
        new Promise((resolve, reject) => {
          server = net.createServer((socket) => {
            acceptCount += 1;
            socket.on('error', () => {});
          });

          server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (address === null || typeof address === 'string') {
              reject(
                new Error('expected server to bind to an address with port'),
              );
              return;
            }
            resolve(address.port);
          });
        });

      const port = await listen();

      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });

      let cleanupCalls = 0;

      const connection = new SolidisConnection({
        ...SolidisDefaultOptions,
        host: '127.0.0.1',
        port,
        maxConnectionRetries: 5,
        connectionRetryDelay: 100,
        connectionTimeout: 200,
        enableReadyCheck: false,
      });

      const originalCleanup = connection.cleanup.bind(connection);

      connection.cleanup = () => {
        cleanupCalls += 1;
        originalCleanup();
      };

      connection.on('error', () => {});

      const reopenTimer = setTimeout(() => {
        server = net.createServer((socket) => {
          acceptCount += 1;
          socket.on('error', () => {});
        });

        server.listen(port, '127.0.0.1');
      }, 250);

      await connection.connect();

      clearTimeout(reopenTimer);

      assert.strictEqual(connection.isConnected, true);
      assert.strictEqual(acceptCount, 1);
      assert.strictEqual(
        cleanupCalls,
        3,
        'failed attempts must invoke cleanup before the successful retry',
      );

      connection.quit();

      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    });

    it('catches background reconnect failure after reset() on a dead server', async () => {
      const debugMemory = new SolidisDebugMemory(50);
      const server = new MockRedisServer();
      await server.listen();
      const port = server.port;

      const connection = new SolidisConnection({
        ...SolidisDefaultOptions,
        host: '127.0.0.1',
        port,
        clientName: '',
        enableReadyCheck: false,
        autoReconnect: true,
        maxConnectionRetries: 0,
        connectionTimeout: 500,
        debugMemory,
      });

      connection.on('error', () => {});

      await connection.connect();
      await server.close();

      connection.reset();

      await waitFor(
        () =>
          debugMemory
            .getLogs()
            .some(
              (log) =>
                log.message === 'Solidis connection failed to reset reconnect.',
            ),
        {
          timeout: 3000,
          description: 'reset reconnect failure must be logged via debug',
        },
      );

      connection.quit();
    });

    it('triggers background reconnect failure in the socket close handler', async () => {
      const debugMemory = new SolidisDebugMemory(50);
      const server = new MockRedisServer();
      await server.listen();
      const port = server.port;

      const connection = new SolidisConnection({
        ...SolidisDefaultOptions,
        host: '127.0.0.1',
        port,
        clientName: '',
        enableReadyCheck: false,
        autoReconnect: true,
        maxConnectionRetries: 0,
        connectionTimeout: 500,
        debugMemory,
      });

      connection.on('error', () => {});

      await connection.connect();
      await server.close();

      server.destroySockets();

      await waitFor(
        () =>
          debugMemory
            .getLogs()
            .some(
              (log) =>
                log.message ===
                'Solidis connection failed to background reconnect.',
            ),
        {
          timeout: 5000,
          description:
            'close handler must log the background reconnect failure via debug',
        },
      );

      connection.quit();
    });
  });
});

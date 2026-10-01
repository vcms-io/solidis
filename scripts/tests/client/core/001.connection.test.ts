/** Connection lifecycle, handshake, and reconnection behaviour. */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import net from 'node:net';
import { after, describe, it } from 'node:test';
import tls from 'node:tls';

import { SolidisFeaturedClient } from '../../../../sources/client/featured.ts';
import { SolidisDefaultOptions } from '../../../../sources/common/constants.ts';
import {
  SolidisClientError,
  SolidisConnectionError,
} from '../../../../sources/index.ts';
import { SolidisConnection } from '../../../../sources/modules/connection.ts';
import {
  buildClientOptions,
  closeClient,
  createClient,
  delay,
  MockRedisServer,
  resolveConnectionTarget,
  waitFor,
} from '../../utils/index.ts';

import type { SolidisClientFrozenOptions } from '../../../../sources/index.ts';
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

    const hashKey = `solidis:test:resp3-verify:${Date.now()}`;

    await client.hset(hashKey, 'field', 'value');

    const hashReply = await client.hgetall(hashKey);

    assert.deepStrictEqual(
      hashReply,
      { field: 'value' },
      'RESP3 must return HGETALL as a plain object, not an array of pairs',
    );

    await client.del(hashKey);
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
    const client = track(
      await createClient({
        uri: `redis://${resolveConnectionTarget().host}:${resolveConnectionTarget().port}`,
      }),
    );

    assert.strictEqual(await client.ping(), 'PONG');
  });

  it('accepts enableReadyCheck in both states without error', async () => {
    let enabledReadyFired = false;

    const enabled = track(
      new SolidisFeaturedClient(
        buildClientOptions({ enableReadyCheck: true, lazyConnect: true }),
      ),
    );

    enabled.on('error', () => {});

    enabled.on('ready', () => {
      enabledReadyFired = true;
    });

    await enabled.connect();

    assert.strictEqual(
      enabledReadyFired,
      true,
      'enableReadyCheck: true must emit a ready event after connection',
    );
    assert.strictEqual(await enabled.ping(), 'PONG');

    let disabledReadyFired = false;

    const disabled = track(
      new SolidisFeaturedClient(
        buildClientOptions({ enableReadyCheck: false, lazyConnect: true }),
      ),
    );

    disabled.on('error', () => {});

    disabled.on('ready', () => {
      disabledReadyFired = true;
    });

    await disabled.connect();

    assert.strictEqual(
      disabledReadyFired,
      true,
      'enableReadyCheck: false must also emit a ready event',
    );
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

  it('retries and eventually rejects on persistent failure', async (context) => {
    context.mock.method(Math, 'random', () => 1);

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

    const errors: unknown[] = [];
    const reconnecting: [number, number][] = [];

    client.on('error', (error) => {
      errors.push(error);
    });
    client.on('reconnecting', (attempt, delay) => {
      reconnecting.push([attempt, delay]);
    });

    await assert.rejects(
      () => client.connect(),
      (error: Error) =>
        error instanceof SolidisConnectionError &&
        error.message === 'Connection failed after 1 retries.' &&
        error.cause instanceof SolidisConnectionError &&
        error.cause.message === 'connect ECONNREFUSED 127.0.0.1:1',
    );

    assert.deepStrictEqual(reconnecting, [[1, 10]]);
    assert.strictEqual(errors.length, 2);
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
        error instanceof SolidisConnectionError &&
        error.message === 'Connection failed after 0 retries.' &&
        error.cause instanceof SolidisConnectionError &&
        error.cause.message === 'connect ECONNREFUSED 127.0.0.1:1',
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
        error instanceof SolidisConnectionError &&
        error.message === 'Connection failed after 0 retries.',
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

  it('completes a large write', async () => {
    const client = track(await createClient());

    assert.strictEqual(await client.ping(), 'PONG');

    const largeKey = `solidis:test:swt-write:${Date.now()}`;
    const largeValue = 'x'.repeat(100000);

    await client.set(largeKey, largeValue);

    const retrieved = await client.get(largeKey);

    assert.strictEqual(
      retrieved,
      largeValue,
      'a large payload must complete successfully',
    );

    await client.del(largeKey);
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
        entry.message === 'Requester serialized: *1\r\n$4\r\nPING\r\n',
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
          error.message === 'Cannot connect: user quit the connection.',
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

    it('retries with exponential backoff until the server comes back', async (context) => {
      context.mock.method(Math, 'random', () => 1);

      let acceptCount = 0;

      const createServer = () =>
        net.createServer((socket) => {
          acceptCount += 1;
          socket.on('error', () => {});
        });

      let server = createServer();

      const port = await new Promise<number>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          resolve((server.address() as net.AddressInfo).port);
        });
      });

      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });

      const connection = new SolidisConnection({
        ...SolidisDefaultOptions,
        host: '127.0.0.1',
        port,
        maxConnectionRetries: 10,
        connectionRetryDelay: 20,
        maxConnectionRetryDelay: 80,
        connectionTimeout: 200,
      });
      const delays: number[] = [];

      connection.on('error', () => {});
      connection.on('reconnecting', (_attempt, delay) => {
        delays.push(delay);
      });

      const reopenTimer = setTimeout(() => {
        server = createServer();
        server.listen(port, '127.0.0.1');
      }, 250);

      try {
        await connection.connect();
      } finally {
        clearTimeout(reopenTimer);
      }

      assert.strictEqual(connection.isConnected, true);
      assert.strictEqual(acceptCount, 1);
      assert.ok(delays.length >= 3, `expected 3+ retries, got ${delays}`);
      assert.deepStrictEqual(
        delays,
        delays.map((_, index) => Math.min(20 * 2 ** index, 80)),
      );

      connection.quit();

      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    });

    it('emits close with the reset error and reconnects with capped backoff until quit', async (context) => {
      context.mock.method(Math, 'random', () => 1);

      const server = new MockRedisServer();

      await server.listen();

      const connection = new SolidisConnection({
        ...SolidisDefaultOptions,
        host: '127.0.0.1',
        port: server.port,
        maxConnectionRetries: 0,
        connectionRetryDelay: 10,
        maxConnectionRetryDelay: 40,
        connectionTimeout: 500,
      });
      const closes: unknown[] = [];
      const reconnecting: [number, number][] = [];
      const error = new Error('reset by the requester');

      connection.on('error', () => {});
      connection.on('close', (closeError) => {
        closes.push(closeError);
      });
      connection.on('reconnecting', (attempt, delay) => {
        reconnecting.push([attempt, delay]);
      });

      await connection.connect();

      connection.reset(error);
      connection.reset(new Error('ignored while disconnected'));

      assert.deepStrictEqual(closes, [error]);
      assert.strictEqual(connection.isConnected, false);

      await server.close();

      connection.reconnect();

      await waitFor(() => reconnecting.length >= 4, {
        timeout: 5000,
        description: 'background reconnect attempts',
      });

      connection.quit();

      assert.deepStrictEqual(reconnecting.slice(0, 4), [
        [2, 20],
        [3, 40],
        [4, 40],
        [5, 40],
      ]);

      const settled = reconnecting.length;

      await delay(100);

      assert.strictEqual(reconnecting.length, settled);
    });

    it('spreads each reconnect delay between half and all of the backoff', async (context) => {
      async function collectDelays(count: number) {
        const server = new MockRedisServer();

        await server.listen();

        const connection = new SolidisConnection({
          ...SolidisDefaultOptions,
          host: '127.0.0.1',
          port: server.port,
          maxConnectionRetries: 0,
          connectionRetryDelay: 8,
          maxConnectionRetryDelay: 32,
          connectionTimeout: 500,
        });
        const delays: number[] = [];

        connection.on('error', () => {});
        connection.on('reconnecting', (_attempt, delay) => {
          delays.push(delay);
        });

        await connection.connect();
        await server.close();

        connection.reset(new Error('reset by the test'));
        connection.reconnect();

        await waitFor(() => delays.length >= count, {
          timeout: 5000,
          description: 'reconnect attempts',
        });

        connection.quit();

        return delays.slice(0, count);
      }

      const random = context.mock.method(Math, 'random', () => 0);

      assert.deepStrictEqual(await collectDelays(4), [8, 16, 16, 16]);

      random.mock.restore();

      const caps = [16, 32, 32, 32, 32, 32, 32, 32];
      const delays = await collectDelays(caps.length);

      for (const [index, delay] of delays.entries()) {
        assert.ok(
          delay >= caps[index] / 2 && delay <= caps[index],
          `delay ${delay} is outside [${caps[index] / 2}, ${caps[index]}]`,
        );
      }
    });

    it('emits close once and refuses writes when the server drops the socket', async () => {
      const server = new MockRedisServer();

      await server.listen();

      const connection = new SolidisConnection({
        ...SolidisDefaultOptions,
        host: '127.0.0.1',
        port: server.port,
      });
      const closes: unknown[] = [];

      connection.on('close', (error) => {
        closes.push(error);
      });

      try {
        await connection.connect();

        server.destroySockets();

        await waitFor(() => closes.length === 1);
        await delay(20);

        const [error] = closes;

        assert.strictEqual(closes.length, 1);
        assert.ok(error instanceof SolidisConnectionError);
        assert.strictEqual(error.message, 'Connection closed.');
        assert.strictEqual(connection.isConnected, false);
        assert.throws(() => connection.write(Buffer.from('PING')), {
          name: 'SolidisConnectionError',
          message: 'Socket is not connected.',
        });
      } finally {
        connection.quit();
        await server.close();
      }
    });

    describe('with a scripted socket', () => {
      class ScriptedSocket extends EventEmitter {
        public destroyed = false;

        public destroy() {
          this.destroyed = true;

          return this;
        }

        public setNoDelay() {
          return this;
        }

        public setKeepAlive() {
          return this;
        }

        public write() {
          return true;
        }
      }

      async function withScriptedSockets(
        run: (sockets: ScriptedSocket[]) => Promise<void>,
      ) {
        const sockets: ScriptedSocket[] = [];
        const originalConnect = net.connect;

        net.connect = (() => {
          const socket = new ScriptedSocket();

          sockets.push(socket);

          return socket;
        }) as unknown as typeof net.connect;

        try {
          await run(sockets);
        } finally {
          net.connect = originalConnect;
        }
      }

      function createConnection(
        overrides: Partial<SolidisClientFrozenOptions> = {},
      ) {
        const connection = new SolidisConnection({
          ...SolidisDefaultOptions,
          host: '127.0.0.1',
          port: 1,
          ...overrides,
        });

        connection.on('error', () => {});

        return connection;
      }

      it('ignores a stale socket that connects after its attempt timed out', async () => {
        await withScriptedSockets(async (sockets) => {
          const connection = createConnection({
            connectionTimeout: 20,
            connectionRetryDelay: 5,
            maxConnectionRetries: 1,
          });
          const received: Buffer[] = [];
          const closes: unknown[] = [];

          connection.on('data', (chunk) => {
            received.push(chunk);
          });
          connection.on('close', (error) => {
            closes.push(error);
          });

          const connected = connection.connect();

          await waitFor(() => sockets.length === 2, {
            description: 'retry attempt started',
          });

          const [stale, current] = sockets;

          assert.strictEqual(stale.destroyed, true);

          stale.emit('connect');

          assert.strictEqual(connection.isConnected, false);

          current.emit('connect');

          await connected;

          stale.emit('data', Buffer.from('+STALE\r\n'));
          stale.emit('drain');
          stale.emit('error', new Error('stale failure'));
          stale.emit('close', true);
          current.emit('data', Buffer.from('+FRESH\r\n'));

          assert.deepStrictEqual(received, [Buffer.from('+FRESH\r\n')]);
          assert.deepStrictEqual(closes, []);
          assert.strictEqual(connection.isConnected, true);

          connection.quit();

          assert.strictEqual(current.destroyed, true);
        });
      });

      it('rejects every connect waiter after the retry budget is spent', async () => {
        await withScriptedSockets(async (sockets) => {
          const connection = createConnection({
            connectionTimeout: 10,
            connectionRetryDelay: 5,
            maxConnectionRetries: 2,
          });

          const [first, second] = await Promise.allSettled([
            connection.connect(),
            connection.connect(),
          ]);

          assert.strictEqual(sockets.length, 3);

          for (const result of [first, second]) {
            if (result.status !== 'rejected') {
              assert.fail('connect must reject once retries are exhausted');
            }

            assert.ok(result.reason instanceof SolidisConnectionError);
            assert.strictEqual(
              result.reason.message,
              'Connection failed after 2 retries.',
            );
            assert.ok(result.reason.cause instanceof SolidisConnectionError);
            assert.strictEqual(
              result.reason.cause.message,
              'Connection timeout (10 ms).',
            );
          }
        });
      });

      it('rejects pending connect waiters on quit and emits end once', async () => {
        await withScriptedSockets(async (sockets) => {
          const connection = createConnection({ connectionTimeout: 20 });
          const errors: Error[] = [];

          let endCount = 0;

          connection.on('error', (error) => errors.push(error));
          connection.on('end', () => {
            endCount += 1;
          });

          const connecting = connection.connect();

          assert.strictEqual(sockets.length, 1);

          connection.quit();
          connection.quit();

          await assert.rejects(connecting, {
            name: 'SolidisConnectionError',
            message: 'Cannot connect: user quit the connection.',
          });
          assert.strictEqual(sockets[0].destroyed, true);
          assert.strictEqual(endCount, 1);

          connection.reconnect();

          await delay(60);

          assert.strictEqual(sockets.length, 1);
          assert.deepStrictEqual(
            errors,
            [],
            'the timeout of an abandoned attempt must not be reported',
          );
        });
      });

      it('backs off after a reset unless the backoff was reset', async () => {
        await withScriptedSockets(async (sockets) => {
          const delayed = createConnection({
            connectionTimeout: 0,
            connectionRetryDelay: 1000,
          });
          const immediate = createConnection({
            connectionTimeout: 0,
            connectionRetryDelay: 1000,
          });

          for (const connection of [delayed, immediate]) {
            const connecting = connection.connect();

            sockets[sockets.length - 1].emit('connect');

            await connecting;

            connection.reset(new Error('reset'));
          }

          assert.strictEqual(sockets.length, 2);

          delayed.reconnect();

          assert.strictEqual(sockets.length, 2);

          immediate.resetBackoff();
          immediate.reconnect();

          assert.strictEqual(sockets.length, 3);

          delayed.quit();
          immediate.quit();
        });
      });

      it('connects over TLS when tls options are given', async () => {
        const originalConnect = tls.connect;
        const sockets: ScriptedSocket[] = [];
        const optionsSeen: unknown[] = [];

        tls.connect = ((options: unknown) => {
          const socket = new ScriptedSocket();

          optionsSeen.push(options);
          sockets.push(socket);

          return socket;
        }) as unknown as typeof tls.connect;

        try {
          const connection = createConnection({
            connectionTimeout: 0,
            tls: { servername: 'redis.example' },
          });

          const connecting = connection.connect();

          sockets[0].emit('connect');

          assert.strictEqual(connection.isConnected, false);

          sockets[0].emit('secureConnect');

          await connecting;

          assert.deepStrictEqual(optionsSeen, [
            { servername: 'redis.example', host: '127.0.0.1', port: 1 },
          ]);

          connection.quit();
        } finally {
          tls.connect = originalConnect;
        }
      });
    });
  });
});

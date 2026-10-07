/** Connection lifecycle, handshake, and reconnection behaviour. */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import net from 'node:net';
import { describe, it } from 'node:test';
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
  formatTargetAddress,
  MockRedisServer,
  mockClientOptions,
  nextEvent,
  track,
  waitFor,
  withTimeout,
} from '../../utils/index.ts';

import type {
  SolidisClientFrozenOptions,
  SolidisDebugLog,
} from '../../../../sources/index.ts';

describe('connection', () => {
  it('connects and answers PING', async () => {
    const client = await createClient();

    assert.strictEqual(await client.ping(), 'PONG');
  });

  it('echoes the exact payload', async () => {
    const client = await createClient();

    assert.strictEqual(await client.echo('solidis'), 'solidis');
  });

  it('emits connect then ready in order', async () => {
    const events: string[] = [];

    const client = track(
      new SolidisFeaturedClient(buildClientOptions({ lazyConnect: true })),
    );

    client.on('error', () => {});
    client.on('connect', () => events.push('connect'));
    client.on('ready', () => events.push('ready'));

    await client.connect();

    assert.deepStrictEqual(events, ['connect', 'ready']);
  });

  it('honours lazyConnect (no socket until connect)', async () => {
    const server = new MockRedisServer();

    await server.listen();

    const client = track(
      new SolidisFeaturedClient(mockClientOptions(server.port)),
    );

    client.on('error', () => {});

    let readyFired = false;
    client.on('ready', () => {
      readyFired = true;
    });

    await delay(50);

    assert.strictEqual(readyFired, false);
    assert.strictEqual(server.acceptedCount, 0);

    await client.connect();

    assert.strictEqual(readyFired, true);

    await waitFor(() => server.acceptedCount === 1, {
      description: 'the server accepted the connection',
    });

    client.quit();
    await server.close();
  });

  it('treats repeated connect() calls as idempotent', async () => {
    const client = await createClient();

    await client.connect();
    await client.connect();

    assert.strictEqual(await client.ping(), 'PONG');
  });

  it('exposes a normalised connection uri', async () => {
    const client = await createClient();

    assert.strictEqual(client.uri, `redis://${formatTargetAddress()}`);
  });

  it('rejects commands after quit with a client error', async () => {
    const client = track(
      new SolidisFeaturedClient(buildClientOptions({ lazyConnect: true })),
    );

    client.on('error', () => {});

    await client.connect();
    await client.ping();

    const ended = nextEvent(client, 'end');

    client.quit();

    await ended;

    await assert.rejects(
      () => client.ping(),
      (error: Error) =>
        error instanceof SolidisClientError &&
        error.message === 'The client was quit.',
    );
  });

  it('negotiates RESP3 when requested', async () => {
    const client = await createClient({ protocol: 'RESP3' });

    assert.strictEqual(await client.ping(), 'PONG');

    const hashKey = `solidis:test:resp3-verify:${Date.now()}`;

    await client.hset(hashKey, 'field', 'value');

    const hashReply = await client.hgetall(hashKey);
    const [[rawReply]] = await client.send([['HGETALL', hashKey]]);

    assert.deepStrictEqual(
      hashReply,
      { field: 'value' },
      'RESP3 must return HGETALL as a plain object, not an array of pairs',
    );
    assert.ok(
      rawReply instanceof Map,
      'the server must answer in RESP3, where HGETALL is a map',
    );

    await client.del(hashKey);
  });

  it('selects a non-zero database without error', async () => {
    const client = await createClient();

    assert.strictEqual(await client.select(1), 'OK');
    await client.flushdb();
    assert.strictEqual(await client.select(0), 'OK');
  });

  it('supports many independent clients concurrently', async () => {
    const clients = await Promise.all(
      Array.from({ length: 16 }, () => createClient()),
    );

    const pongs = await Promise.all(clients.map((client) => client.ping()));

    assert.deepStrictEqual(
      pongs,
      Array.from({ length: 16 }, () => 'PONG'),
    );
  });

  for (const [protocol, sent, skipped] of [
    ['RESP3', 'HELLO', 'CLIENT SETNAME'],
    ['RESP2', 'CLIENT SETNAME', 'HELLO'],
  ] as const) {
    it(`sends clientName with ${sent} on ${protocol}`, async () => {
      const name = `solidis-${protocol}-${Date.now()}`;
      const client = track(
        new SolidisFeaturedClient(
          buildClientOptions({
            clientName: name,
            protocol,
            debug: true,
            lazyConnect: true,
          }),
        ),
      );
      const writes: string[] = [];

      client.on('debug', ({ message }: SolidisDebugLog) => {
        if (message.startsWith('Requester serialized')) {
          writes.push(message.slice(message.indexOf(': ') + 2));
        }
      });

      await client.connect();

      assert.strictEqual(await client.clientGetname(), name);
      assert.ok(writes.includes(sent), writes.join(' | '));
      assert.ok(!writes.includes(skipped), writes.join(' | '));
    });
  }

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
    const autoClient = track(
      new SolidisFeaturedClient(buildClientOptions({ lazyConnect: false })),
    );

    let isReady = false;

    autoClient.on('error', () => {});
    autoClient.on('ready', () => {
      isReady = true;
    });

    await waitFor(() => isReady, {
      timeout: 10_000,
      description: 'ready without connect()',
    });

    assert.strictEqual(await autoClient.ping(), 'PONG');
  });

  it('retries and eventually rejects on persistent failure', async (context) => {
    context.mock.method(Math, 'random', () => 1);

    const client = track(
      new SolidisFeaturedClient(
        buildClientOptions({
          host: '127.0.0.1',
          port: 1,
          lazyConnect: true,
          maxConnectionRetries: 1,
          connectionRetryDelay: 10,
          connectionTimeout: 100,
        }),
      ),
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

    assert.deepStrictEqual(reconnecting, [[2, 10]]);
    assert.strictEqual(errors.length, 2);
  });

  it('announces every retry of the first connect, also without a retry delay', async () => {
    for (const [options, delays] of [
      [{ connectionRetryDelay: 0 }, [0, 0]],
      [{ connectionRetryDelay: -50 }, [0, 0]],
      [{ maxConnectionRetryDelay: Number.NaN }, [0, 0]],
    ] as const) {
      const client = track(
        new SolidisFeaturedClient(
          buildClientOptions({
            host: '127.0.0.1',
            port: 1,
            lazyConnect: true,
            maxConnectionRetries: 2,
            connectionTimeout: 100,
            ...options,
          }),
        ),
      );
      const reconnecting: [number, number][] = [];

      client.on('error', () => {});
      client.on('reconnecting', (attempt, delay) => {
        reconnecting.push([attempt, delay]);
      });

      await assert.rejects(() => client.connect(), {
        message: 'Connection failed after 2 retries.',
      });
      assert.deepStrictEqual(reconnecting, [
        [2, delays[0]],
        [3, delays[1]],
      ]);
    }
  });

  it('rejects connection to wrong port with zero timeout', async () => {
    const client = track(
      new SolidisFeaturedClient(
        buildClientOptions({
          host: '127.0.0.1',
          port: 1,
          lazyConnect: true,
          connectionTimeout: 0,
          maxConnectionRetries: 0,
        }),
      ),
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
    const raceClient = track(
      new SolidisFeaturedClient(buildClientOptions({ lazyConnect: true })),
    );

    raceClient.on('error', () => {});

    const [first, second] = await Promise.allSettled([
      raceClient.connect(),
      raceClient.connect(),
    ]);

    assert.strictEqual(first.status, 'fulfilled');
    assert.strictEqual(second.status, 'fulfilled');
    assert.strictEqual(await raceClient.ping(), 'PONG');
  });

  it('rejects with the connection timeout when the host does not answer', async () => {
    const server = new MockRedisServer();

    await server.listen();

    const silentClient = track(
      new SolidisFeaturedClient(
        mockClientOptions(server.port, { tls: {}, connectionTimeout: 100 }),
      ),
    );

    silentClient.on('error', () => {});

    try {
      await assert.rejects(
        () => withTimeout(silentClient.connect(), 'connect()'),
        (error: Error) =>
          error instanceof SolidisConnectionError &&
          error.message === 'Connection failed after 0 retries.' &&
          error.cause instanceof SolidisConnectionError &&
          error.cause.message === 'Connection timeout (100 ms).',
      );
      assert.strictEqual(server.acceptedCount, 1);
    } finally {
      silentClient.quit();
      await server.close();
    }
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
        error.message === 'The client was quit.',
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
    const killer = await createClient();
    const reconnected = nextEvent(reconnectClient, 'reconnected');

    try {
      await killer.clientKill(clientId);
      await reconnected;

      assert.strictEqual(await reconnectClient.get(key), 'before-kill');
    } finally {
      await closeClient(killer);
      await closeClient(reconnectClient);
    }
  });

  it('completes a large write', async () => {
    const client = await createClient();

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
        entry.message === 'Requester serialized 14 bytes: PING',
    );

    assert.ok(
      pingDebugEntry,
      'Expected a PING command debug entry after ping with debug enabled',
    );

    await closeClient(debugClient);
  });

  it('wraps connection error in SolidisClientError on send', async () => {
    const badClient = track(
      new SolidisFeaturedClient(
        buildClientOptions({
          lazyConnect: true,
          host: '127.0.0.1',
          port: 1,
          connectionTimeout: 50,
          maxConnectionRetries: 0,
        }),
      ),
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

      const connection = track(
        new SolidisConnection({
          ...SolidisDefaultOptions,
          host: '127.0.0.1',
          port: server.port,
          clientName: '',
          enableReadyCheck: false,
          autoReconnect: false,
          maxConnectionRetries: 0,
        }),
      );

      connection.on('error', () => {});

      await connection.connect();
      connection.quit();

      await assert.rejects(
        () => connection.connect(),
        (error: Error) =>
          error instanceof SolidisClientError &&
          error.message === 'The client was quit.',
      );

      await server.close();
    });

    it('returns immediately when connect is called on an established transport', async () => {
      const server = new MockRedisServer();
      await server.listen();

      const connection = track(
        new SolidisConnection({
          ...SolidisDefaultOptions,
          host: '127.0.0.1',
          port: server.port,
          clientName: '',
          enableReadyCheck: false,
          autoReconnect: false,
        }),
      );

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

      const server = new MockRedisServer();
      const port = await server.listen();

      await server.close();

      const connection = track(
        new SolidisConnection({
          ...SolidisDefaultOptions,
          host: '127.0.0.1',
          port,
          maxConnectionRetries: 10,
          connectionRetryDelay: 20,
          maxConnectionRetryDelay: 80,
          connectionTimeout: 200,
        }),
      );
      const delays: number[] = [];

      connection.on('error', () => {});
      connection.on('reconnecting', (_attempt, delay) => {
        delays.push(delay);

        if (delays.length === 3) {
          server.listen(port);
        }
      });

      await connection.connect();

      assert.strictEqual(connection.isConnected, true);
      assert.strictEqual(server.acceptedCount, 1);
      assert.deepStrictEqual(delays, [20, 40, 80]);

      connection.quit();
      await server.close();
    });

    it('emits close with the reset error and stops reconnecting once the retry budget is spent', async (context) => {
      context.mock.method(Math, 'random', () => 1);

      const server = new MockRedisServer();

      await server.listen();

      const connection = track(
        new SolidisConnection({
          ...SolidisDefaultOptions,
          host: '127.0.0.1',
          port: server.port,
          maxConnectionRetries: 3,
          connectionRetryDelay: 10,
          maxConnectionRetryDelay: 40,
          connectionTimeout: 500,
        }),
      );
      const closes: unknown[] = [];
      const errors: Error[] = [];
      const reconnecting: [number, number][] = [];
      const error = new Error('reset by the requester');

      connection.on('error', (failure) => {
        errors.push(failure);
      });
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

      await waitFor(
        () => errors.at(-1)?.message === 'Connection failed after 3 retries.',
        { timeout: 5000, description: 'reconnect budget spent' },
      );

      assert.deepStrictEqual(reconnecting, [
        [2, 10],
        [3, 20],
        [4, 40],
        [5, 40],
      ]);
      assert.strictEqual(errors.length, 4);

      const giveUp = errors.at(-1);

      assert.ok(giveUp instanceof SolidisConnectionError);
      assert.ok(giveUp.cause instanceof SolidisConnectionError);
      assert.match(giveUp.cause.message, /ECONNREFUSED/);

      await delay(100);

      assert.strictEqual(reconnecting.length, 4);

      connection.reconnect();

      await delay(50);

      assert.strictEqual(
        reconnecting.length,
        4,
        'reconnect() must not start a new cycle once the budget is spent',
      );

      await assert.rejects(connection.connect(), {
        name: 'SolidisConnectionError',
        message: 'Connection failed after 3 retries.',
      });

      const cycles = reconnecting.length;

      connection.reconnect();

      await waitFor(() => reconnecting.length === cycles + 1, {
        description: 'a new reconnect cycle after connect()',
      });

      assert.deepStrictEqual(reconnecting[cycles], [1, 0]);

      connection.quit();
    });

    it('spreads each reconnect delay between half and all of the backoff', async (context) => {
      async function collectDelays(count: number) {
        const server = new MockRedisServer();

        await server.listen();

        const connection = track(
          new SolidisConnection({
            ...SolidisDefaultOptions,
            host: '127.0.0.1',
            port: server.port,
            maxConnectionRetries: 100,
            connectionRetryDelay: 8,
            maxConnectionRetryDelay: 32,
            connectionTimeout: 500,
          }),
        );
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

      assert.deepStrictEqual(await collectDelays(4), [4, 8, 16, 16]);

      random.mock.restore();

      const caps = [8, 16, 32, 32, 32, 32, 32, 32];
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

      const connection = track(
        new SolidisConnection({
          ...SolidisDefaultOptions,
          host: '127.0.0.1',
          port: server.port,
        }),
      );
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
        public noDelay = false;
        public keepAlive = false;

        public destroy(error?: Error) {
          if (!this.destroyed) {
            this.destroyed = true;

            process.nextTick(() => {
              if (error) {
                this.emit('error', error);
              }

              this.emit('close', error !== undefined);
            });
          }

          return this;
        }

        public setNoDelay(noDelay: boolean) {
          this.noDelay = noDelay;

          return this;
        }

        public setKeepAlive(keepAlive: boolean) {
          this.keepAlive = keepAlive;

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

        net.connect = ((options: net.NetConnectOpts) => {
          if (!('port' in options) || options.port !== 1) {
            return originalConnect(options);
          }

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
        const connection = track(
          new SolidisConnection({
            ...SolidisDefaultOptions,
            host: '127.0.0.1',
            port: 1,
            ...overrides,
          }),
        );

        connection.on('error', () => {});

        return connection;
      }

      it('spends the reconnect budget on drops and refills it after a connection stayed up', async () => {
        await withScriptedSockets(async (sockets) => {
          const connection = createConnection({
            connectionTimeout: 0,
            connectionRetryDelay: 1,
            maxConnectionRetryDelay: 30,
            maxConnectionRetries: 1,
          });
          const errors: Error[] = [];

          connection.on('error', (error) => errors.push(error));
          connection.on('close', () => connection.reconnect());

          async function dropNext(index: number) {
            await waitFor(() => sockets.length === index + 1, {
              description: `attempt ${index + 1}`,
            });

            sockets[index].emit('connect');
            sockets[index].emit('close');
          }

          const connecting = connection.connect();

          sockets[0].emit('connect');

          await connecting;

          sockets[0].emit('close');

          await dropNext(1);
          await waitFor(() => sockets.length === 3);

          sockets[2].emit('connect');
          connection.resetBackoff();

          await delay(40);

          sockets[2].emit('close');

          await dropNext(3);
          await waitFor(() => sockets.length === 5);

          assert.strictEqual(errors.length, 0);

          await dropNext(4);

          assert.deepStrictEqual(
            errors.map((error) => error.message),
            ['Connection failed after 1 retries.'],
          );

          await delay(40);

          assert.strictEqual(sockets.length, 5);

          connection.quit();
        });
      });

      it('leaves no background reconnect after connect(NaN), as after connect(0)', async () => {
        await withScriptedSockets(async (sockets) => {
          for (const attempts of [0, Number.NaN]) {
            const connection = createConnection({
              connectionTimeout: 0,
              connectionRetryDelay: 1,
              maxConnectionRetryDelay: 30,
            });
            const first = sockets.length;

            connection.on('close', () => connection.reconnect());

            const connecting = connection.connect(attempts);

            sockets[first].emit('connect');

            assert.strictEqual(await connecting, attempts);

            sockets[first].emit('close');

            await delay(40);

            assert.strictEqual(sockets.length, first + 1);

            connection.quit();
          }
        });
      });

      it('refills the reconnect budget after every ready period when maxConnectionRetryDelay is NaN', async () => {
        await withScriptedSockets(async (sockets) => {
          const connection = createConnection({
            connectionTimeout: 0,
            connectionRetryDelay: 1,
            maxConnectionRetryDelay: Number.NaN,
            maxConnectionRetries: 1,
          });
          const errors: Error[] = [];

          connection.on('error', (error) => errors.push(error));
          connection.on('close', () => connection.reconnect());

          const connecting = connection.connect();

          sockets[0].emit('connect');

          await connecting;

          for (let index = 1; index <= 4; index += 1) {
            connection.resetBackoff();
            sockets[index - 1].emit('close');

            await waitFor(() => sockets.length === index + 1, {
              description: `attempt ${index + 1}`,
            });

            sockets[index].emit('connect');
          }

          assert.deepStrictEqual(errors, []);

          connection.quit();
        });
      });

      it('rejects a connection the socket layer refuses on the spot, and reports it when nothing waits', async () => {
        const connection = track(
          new SolidisConnection({
            ...SolidisDefaultOptions,
            host: '127.0.0.1',
            port: 70000,
          }),
        );
        const errors: Error[] = [];
        const reconnects: number[] = [];

        connection.on('error', (error) => errors.push(error));
        connection.on('reconnecting', (attempt) => reconnects.push(attempt));

        const error = await connection
          .connect()
          .catch((failure: unknown) => failure);

        assert.ok(error instanceof SolidisConnectionError);
        assert.ok(error.cause instanceof RangeError);
        assert.strictEqual(errors.length, 0);
        assert.strictEqual(connection.isConnected, false);

        connection.reconnect();

        await waitFor(() => errors.length > 0);

        assert.ok(errors[0] instanceof SolidisConnectionError);
        assert.ok(errors[0].cause instanceof RangeError);
        assert.deepStrictEqual(reconnects, [1]);

        await assert.rejects(connection.connect(), SolidisConnectionError);

        assert.deepStrictEqual(reconnects, [1]);

        connection.quit();
      });

      it('reports a refused connection once, after the constructor returns', async (context) => {
        const emitWarning = context.mock.method(process, 'emitWarning');
        const client = track(
          new SolidisFeaturedClient({
            host: '127.0.0.1',
            port: 70000,
          }),
        );
        const errors: Error[] = [];

        client.on('error', (error) => errors.push(error));

        await waitFor(() => errors.length > 0);
        await delay(20);

        assert.strictEqual(errors.length, 1);
        assert.ok(errors[0] instanceof SolidisConnectionError);
        assert.strictEqual(emitWarning.mock.callCount(), 0);

        client.quit();
      });

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

          const errors: Error[] = [];
          let drains = 0;

          connection.on('error', (error) => errors.push(error));
          connection.on('drain', () => {
            drains += 1;
          });
          stale.emit('data', Buffer.from('+STALE\r\n'));
          stale.emit('drain');

          assert.strictEqual(drains, 0);

          current.emit('drain');

          assert.strictEqual(drains, 1);
          stale.emit('error', new Error('stale failure'));
          stale.emit('close', true);
          current.emit('data', Buffer.from('+FRESH\r\n'));

          assert.deepStrictEqual(received, [Buffer.from('+FRESH\r\n')]);
          assert.deepStrictEqual(closes, []);
          assert.deepStrictEqual(errors, []);
          assert.strictEqual(connection.isConnected, true);

          connection.quit();

          assert.strictEqual(current.destroyed, true);
        });
      });

      it("disables Nagle's algorithm and enables keep-alive once connected", async () => {
        await withScriptedSockets(async (sockets) => {
          const connection = createConnection({ connectionTimeout: 0 });
          const connected = connection.connect();

          sockets[0].emit('connect');

          await connected;

          assert.strictEqual(sockets[0].noDelay, true);
          assert.strictEqual(sockets[0].keepAlive, true);

          connection.quit();
        });
      });

      it('reports an error of the connected socket as a connection error', async () => {
        await withScriptedSockets(async (sockets) => {
          const connection = createConnection({ connectionTimeout: 0 });
          const errors: Error[] = [];
          const connected = connection.connect();

          sockets[0].emit('connect');

          await connected;

          connection.on('error', (error) => errors.push(error));

          const failure = new Error('read ECONNRESET');

          sockets[0].emit('error', failure);

          assert.strictEqual(errors.length, 1);
          assert.ok(errors[0] instanceof SolidisConnectionError);
          assert.strictEqual(errors[0].message, 'read ECONNRESET');
          assert.strictEqual(errors[0].cause, failure);

          connection.quit();
        });
      });

      it('keeps retrying without a limit when maxConnectionRetries is Infinity', async () => {
        await withScriptedSockets(async (sockets) => {
          const connection = createConnection({
            connectionTimeout: 0,
            connectionRetryDelay: 1,
            maxConnectionRetryDelay: 1,
            maxConnectionRetries: Number.POSITIVE_INFINITY,
          });
          const errors: Error[] = [];

          connection.on('error', (error) => errors.push(error));

          const connected = connection.connect();

          for (let index = 0; index < 40; index += 1) {
            await waitFor(() => sockets.length === index + 1, {
              description: `attempt ${index + 1}`,
            });

            sockets[index].emit('close');
          }

          await waitFor(() => sockets.length === 41, {
            description: 'attempt 41',
          });

          sockets[40].emit('connect');

          await connected;

          assert.strictEqual(errors.length, 40);
          assert.ok(
            errors.every(
              (error) => error.message === 'Socket closed before connection.',
            ),
          );
          assert.strictEqual(connection.isConnected, true);

          connection.quit();
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
            name: 'SolidisClientError',
            message: 'The client was quit.',
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

      it('backs off after a reset unless the connection stayed ready for the longest backoff', async () => {
        await withScriptedSockets(async (sockets) => {
          const delayed = createConnection({
            connectionTimeout: 0,
            connectionRetryDelay: 1000,
            maxConnectionRetryDelay: 30,
          });
          const immediate = createConnection({
            connectionTimeout: 0,
            connectionRetryDelay: 1000,
            maxConnectionRetryDelay: 30,
          });
          const reconnecting = new Map<SolidisConnection, number[][]>([
            [delayed, []],
            [immediate, []],
          ]);

          for (const connection of [delayed, immediate]) {
            const connecting = connection.connect();

            sockets[sockets.length - 1].emit('connect');

            await connecting;

            connection.resetBackoff();
            connection.on('reconnecting', (attempt, delay) => {
              reconnecting.get(connection)?.push([attempt, delay]);
            });
          }

          delayed.reset(new Error('reset'));

          await delay(40);

          immediate.reset(new Error('reset'));
          delayed.reconnect();
          immediate.reconnect();

          assert.strictEqual(sockets.length, 2);
          assert.deepStrictEqual(reconnecting.get(immediate), [[1, 0]]);

          const [[attempt, backoff]] = reconnecting.get(delayed) ?? [[]];

          assert.strictEqual(attempt, 2);
          assert.ok(backoff >= 15 && backoff <= 30, `backoff ${backoff}`);

          await delay(5);

          assert.strictEqual(sockets.length, 3);

          await delay(40);

          assert.strictEqual(sockets.length, 4);

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

      it('names the host for SNI unless it is an IP address', async () => {
        const originalConnect = tls.connect;
        const optionsSeen: unknown[] = [];

        tls.connect = ((options: unknown) => {
          optionsSeen.push(options);

          return new ScriptedSocket();
        }) as unknown as typeof tls.connect;

        try {
          for (const host of ['redis.example', '127.0.0.1', '::1']) {
            const connection = createConnection({
              connectionTimeout: 0,
              host,
              tls: {},
            });
            const connecting = connection.connect();

            connection.quit();

            await connecting.catch(() => {});
          }

          assert.deepStrictEqual(optionsSeen, [
            { servername: 'redis.example', host: 'redis.example', port: 1 },
            { servername: undefined, host: '127.0.0.1', port: 1 },
            { servername: undefined, host: '::1', port: 1 },
          ]);
        } finally {
          tls.connect = originalConnect;
        }
      });

      it('treats a connection timeout beyond the timer limit as none', async () => {
        await withScriptedSockets(async (sockets) => {
          const connection = createConnection({
            connectionTimeout: Number.POSITIVE_INFINITY,
          });
          const connecting = connection.connect();

          await delay(20);

          sockets[0].emit('connect');

          await connecting;

          assert.strictEqual(sockets.length, 1);

          connection.quit();
        });
      });

      it('caps a reconnect delay at the timer limit', async (context) => {
        context.mock.method(Math, 'random', () => 1);

        await withScriptedSockets(async (sockets) => {
          const connection = createConnection({
            connectionTimeout: 0,
            connectionRetryDelay: 2 ** 40,
            maxConnectionRetryDelay: Number.POSITIVE_INFINITY,
            maxConnectionRetries: 1,
          });
          const delays: number[] = [];

          connection.on('reconnecting', (_attempt, retryDelay) => {
            delays.push(retryDelay);
          });

          const connecting = connection.connect();

          sockets[0].emit('close');

          assert.deepStrictEqual(delays, [2147483647]);

          connection.quit();

          await connecting.catch(() => {});
        });
      });
    });
  });
});

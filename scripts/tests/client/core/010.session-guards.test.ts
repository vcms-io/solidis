/** Session guards: reconnect pacing, listener re-entrancy, handshake sessions and runtime session state. */

import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../../sources/client/featured.ts';
import {
  RespError,
  RespPush,
  SolidisClient,
  SolidisClientError,
  SolidisCommandError,
  SolidisConnectionError,
  SolidisProtocols,
  SolidisRequesterError,
} from '../../../../sources/index.ts';
import {
  buildClientOptions,
  closeClient,
  createClient,
  createKeyspace,
  delay,
  MockRedisServer,
  mockClientOptions,
  nextEvent,
  track,
  waitFor,
  withTimeout,
} from '../../utils/index.ts';

import type { FeaturedClient, MockDataHandler } from '../../utils/index.ts';

async function startServer(handler: MockDataHandler = () => {}) {
  const server = new MockRedisServer();

  server.onData(handler);

  await server.listen();

  return server;
}

function answerPong(
  socket: { write: (data: string) => unknown },
  data: Buffer,
) {
  const count = data.toString().split('PING').length - 1;

  socket.write('+PONG\r\n'.repeat(Math.max(count, 1)));
}

describe('session-guards', () => {
  const keyspace = createKeyspace('session-guards');

  let killer: FeaturedClient;

  before(async () => {
    killer = await createClient();
  });

  after(async () => {
    await closeClient(killer);
  });

  async function forceReconnect(client: FeaturedClient) {
    const id = await client.clientId();
    const reconnected = nextEvent(client, 'reconnected');

    await killer.clientKill(id);
    await reconnected;
  }

  describe('reconnect pacing', () => {
    it('backs off reconnects to a server that drops every connection right after accepting it', async (context) => {
      context.mock.method(Math, 'random', () => 1);

      const server = await startServer();
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            autoReconnect: true,
            connectionRetryDelay: 20,
            maxConnectionRetryDelay: 80,
            maxConnectionRetries: 100,
          }),
        ),
      );
      const delays: number[] = [];

      client.on('error', () => {});
      client.on('reconnecting', (_attempt, delay) => delays.push(delay));

      try {
        await client.connect();

        const accepted = server.acceptedCount;

        server.closesOnAccept = true;
        server.destroySockets();

        await delay(600);

        const reconnects = server.acceptedCount - accepted;

        assert.ok(
          reconnects >= 4 && reconnects <= 10,
          `${reconnects} reconnects`,
        );
        assert.deepStrictEqual(delays.slice(0, 4), [20, 40, 80, 80]);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('gives up a background reconnect after maxConnectionRetries and reports it, counting NaN or a negative limit as 0', async () => {
      for (const [maxConnectionRetries, retries] of [
        [2, 2],
        [Number.NaN, 0],
        [-1, 0],
      ]) {
        const server = await startServer();
        const client = track(
          new SolidisFeaturedClient(
            mockClientOptions(server.port, {
              autoReconnect: true,
              maxConnectionRetries,
              connectionRetryDelay: 5,
              maxConnectionRetryDelay: 10,
            }),
          ),
        );
        const errors: Error[] = [];
        const attempts: number[] = [];
        const message = `Connection failed after ${retries} retries.`;

        client.on('error', (error) => errors.push(error));
        client.on('reconnecting', (attempt) => attempts.push(attempt));

        try {
          await client.connect();
          await server.close();
          await waitFor(() =>
            errors.some((error) => error.message === message),
          );
          await delay(100);

          assert.strictEqual(attempts.length, retries + 1);

          const giveUp = errors.at(-1);

          assert.ok(giveUp instanceof SolidisConnectionError);
          assert.strictEqual(giveUp.message, message);
        } finally {
          client.quit();
          await server.close();
        }
      }
    });

    it('gives up on a server that drops every connection right after accepting it, counting NaN or a negative limit as 0', async () => {
      for (const [maxConnectionRetries, retries] of [
        [2, 2],
        [Number.NaN, 0],
        [-1, 0],
      ]) {
        const server = await startServer();
        const client = track(
          new SolidisFeaturedClient(
            mockClientOptions(server.port, {
              autoReconnect: true,
              maxConnectionRetries,
              connectionRetryDelay: 5,
              maxConnectionRetryDelay: 10,
            }),
          ),
        );
        const errors: Error[] = [];

        client.on('error', (error) => errors.push(error));

        try {
          await client.connect();

          const accepted = server.acceptedCount;

          server.closesOnAccept = true;
          server.destroySockets();

          await waitFor(() =>
            errors.some(
              (error) =>
                error.message === `Connection failed after ${retries} retries.`,
            ),
          );
          await delay(100);

          assert.strictEqual(server.acceptedCount - accepted, retries + 1);
        } finally {
          client.quit();
          await server.close();
        }
      }
    });

    it('starts over from the first attempt once a background reconnect gave up', async () => {
      const server = await startServer(answerPong);
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            autoReconnect: true,
            maxConnectionRetries: 2,
            connectionRetryDelay: 200,
            maxConnectionRetryDelay: 400,
          }),
        ),
      );
      const errors: Error[] = [];
      const attempts: number[][] = [];

      client.on('error', (error) => errors.push(error));
      client.on('reconnecting', (attempt, delay) =>
        attempts.push([attempt, delay]),
      );

      try {
        await client.connect();

        server.closesOnAccept = true;
        server.destroySockets();

        await waitFor(
          () =>
            errors.some(
              (error) => error.message === 'Connection failed after 2 retries.',
            ),
          { timeout: 5000 },
        );

        attempts.length = 0;
        server.closesOnAccept = false;

        assert.strictEqual(await client.ping(), 'PONG');
        assert.deepStrictEqual(attempts, [[1, 0]]);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('starts over from the first attempt when the listener of a refused reconnect that gave up sends a command', async () => {
      const server = await startServer(answerPong);
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            autoReconnect: true,
            maxConnectionRetries: 2,
            connectionRetryDelay: 20,
            maxConnectionRetryDelay: 40,
          }),
        ),
      );
      const attempts: number[][] = [];
      const pings: Promise<unknown>[] = [];

      client.on('error', (error) => {
        if (
          pings.length === 0 &&
          error.message === 'Connection failed after 2 retries.'
        ) {
          attempts.length = 0;
          pings.push(client.ping().catch(() => 'rejected'));
        }
      });
      client.on('reconnecting', (attempt, delay) =>
        attempts.push([attempt, delay]),
      );

      await client.connect();
      await server.close();
      await waitFor(() => pings.length > 0 && attempts.length > 0, {
        timeout: 5000,
      });

      client.quit();

      assert.deepStrictEqual(attempts[0], [1, 0]);
      assert.deepStrictEqual(await Promise.all(pings), ['rejected']);
    });

    it('announces every reconnect attempt, including the first one after a drop', async () => {
      const server = await startServer(answerPong);
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            autoReconnect: true,
            connectionRetryDelay: 10,
            maxConnectionRetryDelay: 10,
          }),
        ),
      );
      const events: string[] = [];

      client.on('error', () => {});

      for (const event of [
        'connect',
        'ready',
        'close',
        'reconnected',
      ] as const) {
        client.on(event, () => events.push(event));
      }

      client.on('reconnecting', (attempt) =>
        events.push(`reconnecting ${attempt}`),
      );

      try {
        await client.connect();
        await delay(20);

        server.destroySockets();

        await waitFor(() => events.includes('reconnected'));

        assert.deepStrictEqual(events, [
          'connect',
          'ready',
          'close',
          'reconnecting 1',
          'connect',
          'ready',
          'reconnected',
        ]);
        assert.strictEqual(await client.ping(), 'PONG');
      } finally {
        client.quit();
        await server.close();
      }
    });
  });

  describe('listener re-entrancy', () => {
    it('stays quit when a connect listener quits a handshake that sends nothing', async () => {
      const server = await startServer(answerPong);
      const client = track(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );
      const events: string[] = [];

      for (const event of ['connect', 'ready', 'end'] as const) {
        client.on(event, () => events.push(event));
      }

      client.on('connect', () => client.quit());

      try {
        await assert.rejects(client.connect(), {
          name: 'SolidisClientError',
          message: 'The client was quit.',
        });
        await delay(20);

        assert.deepStrictEqual(events, ['connect', 'end']);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('holds a command sent from a close listener until the session is back', async () => {
      const client = await createClient({ connectionRetryDelay: 10 });

      try {
        const sent = new Promise((resolve) => {
          client.once('close', () => {
            resolve(client.ping().catch((error: unknown) => error));
          });
        });

        await forceReconnect(client);

        assert.strictEqual(await sent, 'PONG');
      } finally {
        await closeClient(client);
      }
    });

    it('rejects a command sent from an end listener after quit()', async () => {
      const client = await createClient();
      const sent = new Promise((resolve) => {
        client.once('end', () => {
          resolve(client.ping().catch((error: unknown) => error));
        });
      });

      client.quit();

      const error = await sent;

      assert.ok(error instanceof SolidisClientError);
      assert.strictEqual(error.message, 'The client was quit.');
    });

    it('stops reconnecting when quit() runs inside a reconnecting listener', async () => {
      const server = await startServer(answerPong);
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            autoReconnect: true,
            connectionRetryDelay: 10,
          }),
        ),
      );
      const events: string[] = [];

      client.on('error', () => {});

      for (const event of [
        'connect',
        'ready',
        'close',
        'reconnected',
        'end',
      ] as const) {
        client.on(event, () => events.push(event));
      }

      client.on('reconnecting', () => {
        events.push('reconnecting');
        client.quit();
        client.quit();
      });

      try {
        await client.connect();

        const accepted = server.acceptedCount;

        server.destroySockets();

        await waitFor(() => events.includes('end'));
        await delay(100);

        assert.deepStrictEqual(events, [
          'connect',
          'ready',
          'close',
          'reconnecting',
          'end',
        ]);
        assert.strictEqual(server.acceptedCount, accepted);
        assert.strictEqual(server.connectionCount, 0);
        await assert.rejects(client.ping(), SolidisClientError);
      } finally {
        await server.close();
      }
    });

    it('stops reconnecting when quit() runs inside the error listener of a refused attempt', async () => {
      const server = await startServer(answerPong);
      const { port } = server;
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(port, {
            autoReconnect: true,
            maxConnectionRetries: 5,
            connectionRetryDelay: 10,
            maxConnectionRetryDelay: 10,
          }),
        ),
      );
      const events: string[] = [];

      for (const event of ['connect', 'ready', 'close', 'end'] as const) {
        client.on(event, () => events.push(event));
      }

      client.on('reconnecting', () => events.push('reconnecting'));
      client.on('error', () => {
        if (events.includes('reconnecting')) {
          client.quit();
        }
      });

      await client.connect();
      await server.close();
      await waitFor(() => events.includes('end'));

      const replacement = new MockRedisServer();

      replacement.onData(answerPong);

      await replacement.listen(port);

      try {
        await delay(100);

        assert.deepStrictEqual(events, [
          'connect',
          'ready',
          'close',
          'reconnecting',
          'end',
        ]);
        assert.strictEqual(replacement.acceptedCount, 0);
      } finally {
        client.quit();
        await replacement.close();
      }
    });

    it('rejects only the requests sent before a refused attempt settled them', async () => {
      const server = await startServer(answerPong);
      const { port } = server;
      const client = track(new SolidisFeaturedClient(mockClientOptions(port)));
      const replacement = new MockRedisServer();
      const sends: Promise<unknown>[] = [];

      replacement.onData(answerPong);

      await server.close();

      client.once('error', () => {
        replacement.listen(port);

        const send = (depth: number) => {
          sends.push(client.ping().catch((error: Error) => error.message));

          if (depth < 6) {
            queueMicrotask(() => send(depth + 1));
          }
        };

        queueMicrotask(() => send(1));
      });

      try {
        await assert.rejects(client.connect(), {
          message: 'Connection failed after 0 retries.',
        });
        await waitFor(() => sends.length === 6);

        const replies = await Promise.all(sends);

        assert.strictEqual(replies[0], 'Not connected with redis server.');
        assert.deepStrictEqual(replies.slice(1), Array(5).fill('PONG'));
        assert.strictEqual(replacement.acceptedCount, 1);
      } finally {
        client.quit();
        await replacement.close();
      }
    });

    it('starts one attempt when error and reconnecting listeners send commands and connect', async () => {
      const server = await startServer(answerPong);
      const { port } = server;
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(port, {
            autoReconnect: true,
            connectionRetryDelay: 20,
            maxConnectionRetryDelay: 40,
            maxConnectionRetries: 100,
            commandTimeout: 3000,
          }),
        ),
      );
      const pings: Promise<unknown>[] = [];

      let readyCount = 0;

      client.on('ready', () => {
        readyCount += 1;
      });
      client.on('error', () => {
        client.connect().catch(() => {});
      });
      client.on('reconnecting', () => {
        pings.push(client.ping().catch(() => 'rejected'));
      });

      await client.connect();
      await server.close();
      await waitFor(() => pings.length >= 3);

      const replacement = new MockRedisServer();

      replacement.onData(answerPong);

      await replacement.listen(port);

      try {
        await waitFor(() => readyCount === 2, { timeout: 5000 });
        await delay(200);

        assert.strictEqual(replacement.acceptedCount, 1);
        assert.strictEqual(readyCount, 2);
        assert.ok(
          (await Promise.all(pings)).every((reply) => reply === 'PONG'),
        );

        client.quit();

        await delay(50);

        assert.strictEqual(replacement.connectionCount, 0);
      } finally {
        client.quit();
        await replacement.close();
      }
    });

    it('announces no reconnect after quit() runs inside a ready listener', async () => {
      const server = await startServer(answerPong);
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            autoReconnect: true,
            connectionRetryDelay: 10,
          }),
        ),
      );
      const events: string[] = [];

      client.on('error', () => {});

      for (const event of ['ready', 'reconnected', 'end'] as const) {
        client.on(event, () => events.push(event));
      }

      client.on('ready', () => {
        if (events.length > 1) {
          client.quit();
        }
      });

      try {
        await client.connect();

        server.destroySockets();

        await waitFor(() => events.includes('end'));
        await delay(50);

        assert.deepStrictEqual(events, ['ready', 'ready', 'end']);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('keeps the session working when connect, reconnecting, reconnected and end listeners throw', async () => {
      const server = await startServer(answerPong);
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            autoReconnect: true,
            connectionRetryDelay: 10,
          }),
        ),
      );
      const events = ['connect', 'reconnecting', 'reconnected', 'end'] as const;
      const errors: Error[] = [];

      client.on('error', (error) => errors.push(error));

      for (const event of events) {
        client.on(event, () => {
          throw new Error(`${event} listener bug`);
        });
      }

      try {
        await client.connect();

        server.destroySockets();

        await waitFor(() =>
          errors.some(
            (error) => error.message === "A 'reconnected' listener threw",
          ),
        );

        assert.strictEqual(await client.ping(), 'PONG');

        client.quit();

        for (const event of events) {
          const failure = errors.find(
            (error) => error.message === `A '${event}' listener threw`,
          );

          assert.ok(failure instanceof SolidisClientError, event);
          assert.ok(failure.cause instanceof Error);
          assert.strictEqual(failure.cause.message, `${event} listener bug`);
        }
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('keeps resetting and routing when an error listener throws', async (context) => {
      const rethrown: (() => void)[] = [];
      const server = await startServer((socket, data, mock) => {
        if (data.includes('PING')) {
          socket.write(
            mock.acceptedCount === 1 ? '+PONG\r\n?garbage\r\n' : '+PONG\r\n',
          );
        }
      });
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            autoReconnect: true,
            maxConnectionRetries: 1,
            connectionRetryDelay: 10,
          }),
        ),
      );

      context.mock.method(
        globalThis,
        'queueMicrotask',
        (callback: () => void) => {
          rethrown.push(callback);
        },
      );
      client.on('error', () => {
        throw new Error('listener bug');
      });

      try {
        await client.connect();

        assert.deepStrictEqual(await client.send([['PING']]), [['PONG']]);

        await waitFor(() => server.acceptedCount === 2);

        assert.deepStrictEqual(await client.send([['PING']]), [['PONG']]);
        assert.ok(rethrown.length > 0);

        for (const callback of rethrown) {
          assert.throws(callback, { message: 'listener bug' });
        }
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('keeps the session working when a drain listener throws', async (context) => {
      const server = await startServer(answerPong);
      const connect = net.connect;
      const sockets: net.Socket[] = [];

      context.mock.method(net, 'connect', (options: net.NetConnectOpts) => {
        const socket = connect(options);

        if ('port' in options && options.port === server.port) {
          sockets.push(socket);
        }

        return socket;
      });

      const client = track(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );
      const errors: Error[] = [];

      client.on('error', (error) => errors.push(error));
      client.on('drain', () => {
        throw new Error('drain listener bug');
      });

      try {
        await client.connect();

        sockets[0].emit('drain');

        assert.deepStrictEqual(
          errors.map((error) => error.message),
          ["A 'drain' listener threw"],
        );
        assert.strictEqual(await client.ping(), 'PONG');
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('keeps the session working when ready and close listeners throw', async () => {
      const server = await startServer(answerPong);
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            autoReconnect: true,
            connectionRetryDelay: 10,
          }),
        ),
      );
      const errors: Error[] = [];

      let readyCount = 0;

      client.on('error', (error) => errors.push(error));
      client.on('ready', () => {
        readyCount += 1;

        throw new Error('ready listener bug');
      });
      client.on('close', () => {
        throw new Error('close listener bug');
      });

      try {
        await client.connect();

        server.destroySockets();

        await waitFor(() => readyCount === 2);

        assert.strictEqual(await client.ping(), 'PONG');

        for (const event of ['ready', 'close']) {
          const failure = errors.find(
            (error) => error.message === `A '${event}' listener threw`,
          );

          assert.ok(failure instanceof SolidisClientError);
          assert.ok(failure.cause instanceof Error);
          assert.strictEqual(failure.cause.message, `${event} listener bug`);
        }
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('reports a throwing debug listener as a warning even with an error listener', async () => {
      const server = await startServer(answerPong);
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, { debug: true }),
        ),
      );
      const errors: Error[] = [];
      const warnings: unknown[] = [];
      const onWarning = (warning: unknown) => {
        warnings.push(warning);
      };

      process.on('warning', onWarning);
      client.on('error', (error) => errors.push(error));
      client.on('debug', () => {
        throw new Error('debug listener bug');
      });

      try {
        await client.connect();

        assert.deepStrictEqual(await client.send([['PING']]), [['PONG']]);

        await delay(50);

        assert.deepStrictEqual(errors, []);
        assert.ok(
          warnings.some(
            (warning) =>
              warning instanceof SolidisClientError &&
              warning.message === "A 'debug' listener threw",
          ),
        );
      } finally {
        process.off('warning', onWarning);
        client.quit();
        await server.close();
      }
    });

    it('isolates debug listeners from the requester', async () => {
      const server = await startServer(answerPong);
      const warnings: Error[] = [];
      const onWarning = (warning: Error) => warnings.push(warning);
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, { debug: true }),
        ),
      );
      const quitter = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, { debug: true }),
        ),
      );

      process.on('warning', onWarning);

      try {
        client.on('debug', (entry) => {
          if (entry.message.startsWith('Requester received')) {
            throw new Error('debug listener bug');
          }
        });

        await client.connect();

        assert.deepStrictEqual(
          await Promise.all([client.ping(), client.ping()]),
          ['PONG', 'PONG'],
        );
        assert.strictEqual(await client.ping(), 'PONG');

        await waitFor(() =>
          warnings.some(
            (warning) =>
              warning instanceof SolidisClientError &&
              warning.message === "A 'debug' listener threw",
          ),
        );

        await quitter.connect();

        quitter.on('debug', (entry) => {
          if (entry.message.startsWith('Requester serialized')) {
            quitter.quit();
          }
        });

        await assert.rejects(quitter.ping(), {
          name: 'SolidisClientError',
          message: 'The client was quit.',
        });
      } finally {
        process.off('warning', onWarning);
        client.quit();
        quitter.quit();
        await server.close();
      }
    });
  });

  describe('handshake sessions', () => {
    function startSetnameServer(failures: number) {
      let handshakes = 0;

      return startServer((socket, data) => {
        if (!data.includes('SETNAME')) {
          answerPong(socket, data);

          return;
        }

        handshakes += 1;

        if (handshakes <= failures) {
          socket.destroy();

          return;
        }

        socket.write('+OK\r\n');
      });
    }

    it('retries the first handshake on a new connection when the socket closes during it', async () => {
      const server = await startSetnameServer(1);
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            clientName: 'app',
            maxConnectionRetries: 2,
            connectionRetryDelay: 10,
          }),
        ),
      );
      const events: string[] = [];

      client.on('error', () => {});

      for (const event of ['connect', 'close', 'ready'] as const) {
        client.on(event, () => events.push(event));
      }

      try {
        await client.connect();

        assert.deepStrictEqual(events, [
          'connect',
          'close',
          'connect',
          'ready',
        ]);
        assert.strictEqual(server.acceptedCount, 2);
        assert.strictEqual(await client.ping(), 'PONG');
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('rejects with the lost handshake connection once no retries are left, counting NaN or a negative limit as 0', async () => {
      for (const maxConnectionRetries of [0, Number.NaN, -1]) {
        const server = await startSetnameServer(5);
        const client = track(
          new SolidisFeaturedClient(
            mockClientOptions(server.port, {
              clientName: 'app',
              maxConnectionRetries,
            }),
          ),
        );
        const events: string[] = [];

        client.on('error', () => {});
        client.on('ready', () => events.push('ready'));

        try {
          await assert.rejects(withTimeout(client.connect(), 'connect()'), {
            name: 'SolidisConnectionError',
            message: 'Connection closed during the handshake.',
          });
          assert.deepStrictEqual(events, []);
          assert.strictEqual(server.acceptedCount, 1);
        } finally {
          client.quit();
          await server.close();
        }
      }
    });

    it('never becomes ready after quit() interrupts the handshake', async () => {
      const server = await startServer();
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, { clientName: 'app' }),
        ),
      );
      const events: string[] = [];

      client.on('error', () => {});

      for (const event of ['connect', 'ready', 'end'] as const) {
        client.on(event, () => events.push(event));
      }

      try {
        const connecting = client.connect();

        await waitFor(() => server.received.length > 0);

        client.quit();

        await assert.rejects(connecting, {
          name: 'SolidisClientError',
          message: 'The client was quit.',
        });
        await delay(50);

        assert.deepStrictEqual(events, ['connect', 'end']);
      } finally {
        await server.close();
      }
    });

    it('counts a ready check the server does not know as ready', async () => {
      const server = await startServer((socket, data) => {
        if (data.includes('INFO')) {
          socket.write(
            "-ERR unknown command 'INFO', with args beginning with: 'persistence'\r\n",
          );
        } else {
          answerPong(socket, data);
        }
      });
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, { enableReadyCheck: true }),
        ),
      );

      client.on('error', () => {});

      try {
        await client.connect();

        assert.deepStrictEqual(await client.send([['PING']]), [['PONG']]);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('spends one budget of attempts on refused connections and interrupted handshakes', async () => {
      const server = await startServer((_socket, _data, mock) => {
        void mock.close();
      });
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            enableReadyCheck: true,
            maxConnectionRetries: 2,
            connectionRetryDelay: 10,
            maxConnectionRetryDelay: 20,
          }),
        ),
      );
      const attempts: number[] = [];

      client.on('error', () => {});
      client.on('reconnecting', (attempt) => {
        attempts.push(attempt);
      });

      try {
        await assert.rejects(client.connect(), {
          name: 'SolidisConnectionError',
          message: 'Connection failed after 2 retries.',
        });
        assert.strictEqual(server.acceptedCount, 1);
        assert.deepStrictEqual(attempts, [2, 3]);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('spends one budget of attempts on refused connections before an interrupted handshake', async (context) => {
      context.mock.method(Math, 'random', () => 1);

      const server = await startServer((socket) => {
        socket.destroy();
      });
      const port = server.port;

      await server.close();

      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(port, {
            enableReadyCheck: true,
            maxConnectionRetries: 2,
            connectionRetryDelay: 200,
            maxConnectionRetryDelay: 200,
          }),
        ),
      );
      const attempts: number[] = [];

      let listening: Promise<number> | undefined;

      client.on('error', () => {});
      client.on('reconnecting', (attempt) => {
        attempts.push(attempt);

        if (attempt === 3) {
          listening = server.listen(port);
        }
      });

      try {
        await assert.rejects(client.connect(), {
          name: 'SolidisConnectionError',
          message: 'Connection closed during the handshake.',
        });
        assert.strictEqual(await listening, port);
        assert.strictEqual(server.acceptedCount, 1);
        assert.deepStrictEqual(attempts, [2, 3]);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('clears the ready check timer when quit() interrupts the wait', async (context) => {
      const server = await startServer((socket, data) => {
        if (data.includes('INFO')) {
          socket.write('$9\r\nloading:1\r\n');
        }
      });
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            enableReadyCheck: true,
            readyCheckInterval: 600_000,
          }),
        ),
      );
      const setTimer = context.mock.method(globalThis, 'setTimeout');
      const clearTimer = context.mock.method(globalThis, 'clearTimeout');
      const isReadyCheckWait = (call: { arguments: unknown[] }) =>
        call.arguments[1] === 600_000;

      client.on('error', () => {});

      try {
        const connecting = client.connect().catch((error: unknown) => error);

        await waitFor(async () => setTimer.mock.calls.some(isReadyCheckWait));

        client.quit();
        await connecting;

        const timer = setTimer.mock.calls.find(isReadyCheckWait)?.result;

        assert.ok(
          clearTimer.mock.calls.some((call) => call.arguments[0] === timer),
        );
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('stops a ready check that outlives its connection', async () => {
      let readyChecks = 0;

      const server = await startServer((socket, data) => {
        if (data.includes('INFO')) {
          readyChecks += 1;
          socket.write('$9\r\nloading:1\r\n');
          setTimeout(() => socket.destroy(), 10);
        }
      });
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            enableReadyCheck: true,
            readyCheckInterval: 50,
          }),
        ),
      );

      client.on('error', () => {});

      try {
        await assert.rejects(client.connect(), (error: unknown) => {
          assert.ok(error instanceof SolidisConnectionError);
          assert.strictEqual(
            error.message,
            'Connection closed during the handshake.',
          );
          assert.ok(error.cause instanceof SolidisClientError);
          assert.strictEqual(error.cause.message, 'Ready check failed');
          assert.ok(error.cause.cause instanceof Error);
          assert.strictEqual(
            error.cause.cause.message,
            'Socket is not connected.',
          );

          return true;
        });
        assert.strictEqual(readyChecks, 1);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('waits for the handshake without a deadline when commandTimeout is 0', async () => {
      let readyChecks = 0;

      const server = await startServer((socket, data) => {
        if (data.includes('INFO')) {
          readyChecks += 1;
          socket.write(`$9\r\nloading:${readyChecks < 4 ? 1 : 0}\r\n`);
        } else {
          answerPong(socket, data);
        }
      });
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            enableReadyCheck: true,
            readyCheckInterval: 50,
            commandTimeout: 0,
          }),
        ),
      );

      client.on('error', () => {});

      try {
        assert.deepStrictEqual(await client.send([['PING']]), [['PONG']]);
        assert.strictEqual(readyChecks, 4);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('lets a request with a timeout of 0 wait for the handshake as long as it takes', async () => {
      let readyChecks = 0;

      const server = await startServer((socket, data) => {
        if (data.includes('INFO')) {
          readyChecks += 1;
          socket.write(`$9\r\nloading:${readyChecks < 4 ? 1 : 0}\r\n`);
        } else {
          answerPong(socket, data);
        }
      });
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            enableReadyCheck: true,
            readyCheckInterval: 50,
            commandTimeout: 60,
          }),
        ),
      );

      client.on('error', () => {});

      try {
        const patient = client.send([['PING']], { timeout: 0 });

        await assert.rejects(client.send([['PING']]), (error: unknown) => {
          assert.ok(error instanceof SolidisClientError);
          assert.ok(error.cause instanceof SolidisRequesterError);
          assert.strictEqual(
            error.cause.message,
            'Connection was not ready within 60 ms.',
          );

          return true;
        });
        assert.deepStrictEqual(await patient, [['PONG']]);
        assert.strictEqual(readyChecks, 4);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('announces the first attempt of a reconnect that a request starts', async () => {
      const server = await startServer(answerPong);
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, { maxConnectionRetryDelay: 1 }),
        ),
      );
      const events: unknown[][] = [];

      client.on('error', () => {});
      client.on('reconnecting', (attempt, delay) => {
        events.push(['reconnecting', attempt, delay]);
      });
      client.on('reconnected', () => {
        events.push(['reconnected']);
      });

      try {
        await client.connect();
        await delay(10);

        const closed = nextEvent(client, 'close');

        server.destroySockets();
        await closed;

        assert.deepStrictEqual(await client.send([['PING']]), [['PONG']]);
        assert.deepStrictEqual(events, [
          ['reconnecting', 1, 0],
          ['reconnected'],
        ]);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('ends a ready-check wait as soon as its connection closes', async () => {
      let readyChecks = 0;

      const server = await startServer((socket, data) => {
        if (data.includes('INFO')) {
          readyChecks += 1;

          if (readyChecks === 1) {
            socket.write('$9\r\nloading:1\r\n');
            setTimeout(() => socket.destroy(), 10);
          } else {
            socket.write('$9\r\nloading:0\r\n');
          }
        }
      });
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            enableReadyCheck: true,
            readyCheckInterval: 60_000,
            maxConnectionRetries: 1,
            connectionRetryDelay: 10,
          }),
        ),
      );

      client.on('error', () => {});

      try {
        const outcome = await Promise.race([
          client.connect().then(
            () => 'ready',
            (error: Error) => error.message,
          ),
          delay(2000).then(() => 'still waiting'),
        ]);

        assert.strictEqual(outcome, 'ready');
        assert.strictEqual(readyChecks, 2);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('copies the commands sent before the client is ready', async () => {
      const server = await startServer((socket, data) => {
        socket.write('+OK\r\n'.repeat(data.toString().split('SET').length - 1));
      });
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, { lazyConnect: true }),
        ),
      );
      const command = ['SET', 'a', '1'];
      const batch = [command];

      client.on('error', () => {});

      try {
        const sent = client.send(batch);

        command[2] = '2';
        batch.length = 0;

        assert.deepStrictEqual(await sent, [['OK']]);
        assert.ok(server.received.join('').includes('$1\r\n1\r\n'));
        assert.ok(!server.received.join('').includes('$1\r\n2\r\n'));
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('reports NOAUTH from SELECT and from restored subscriptions as an authentication failure', async () => {
      const selecting = await startServer((socket, data) => {
        if (data.includes('SELECT')) {
          socket.write('-NOAUTH Authentication required.\r\n');
        }
      });
      const selector = track(
        new SolidisFeaturedClient(
          mockClientOptions(selecting.port, { database: 2 }),
        ),
      );

      selector.on('error', () => {});

      try {
        await assert.rejects(selector.connect(), (error: unknown) => {
          assert.ok(error instanceof SolidisClientError);
          assert.strictEqual(error.message, 'Authentication failed');
          assert.ok(error.cause instanceof SolidisCommandError);
          assert.match(error.cause.message, /^\[SELECT\] NOAUTH /);

          return true;
        });
      } finally {
        selector.quit();
        await selecting.close();
      }

      const subscribing = await startServer((socket, data, server) => {
        if (!data.toString().toUpperCase().includes('SUBSCRIBE')) {
          return;
        }

        if (server.acceptedCount === 1) {
          socket.write('*3\r\n$9\r\nsubscribe\r\n$4\r\nnews\r\n:1\r\n');
        } else {
          socket.write('-NOAUTH Authentication required.\r\n');
        }
      });
      const subscriber = track(
        new SolidisFeaturedClient(
          mockClientOptions(subscribing.port, {
            autoReconnect: true,
            maxConnectionRetries: 1,
            connectionRetryDelay: 10,
          }),
        ),
      );
      const errors: Error[] = [];

      subscriber.on('error', (error) => errors.push(error));

      try {
        await subscriber.subscribe('news');

        subscribing.destroySockets();

        await waitFor(() =>
          errors.some((error) => error.message === 'Authentication failed'),
        );

        const failure = errors.find(
          (error) => error.message === 'Authentication failed',
        );

        assert.ok(failure instanceof SolidisClientError);
        assert.ok(failure.cause instanceof RespError);
        assert.strictEqual(failure.cause.code, 'NOAUTH');
        assert.ok(
          !errors.some(
            (error) => error.message === 'Failed to restore subscriptions',
          ),
        );
      } finally {
        subscriber.quit();
        await subscribing.close();
      }
    });

    it('takes the options of a send() made before the connection is ready when it is called', async () => {
      const client = track(
        new SolidisFeaturedClient(
          buildClientOptions({ lazyConnect: true, commandTimeout: 0 }),
        ),
      );
      const options = { timeout: 100 };

      client.on('error', () => {});

      class Deadline {
        get timeout() {
          return 100;
        }
      }

      try {
        const blocked = [options, new Deadline()].map((sendOptions, index) =>
          client.send(
            [
              [
                'BLPOP',
                `solidis:test:late-options:${index}:${Date.now()}`,
                '0',
              ],
            ],
            sendOptions,
          ),
        );

        options.timeout = 0;

        await client.connect();

        for (const request of blocked) {
          const outcome = await Promise.race([
            request.then(
              () => 'resolved',
              (error: unknown) => error,
            ),
            delay(2000).then(() => 'still pending'),
          ]);

          assert.ok(outcome instanceof SolidisRequesterError, String(outcome));
          assert.strictEqual(
            outcome.message,
            'Command(s) timed out after 100 ms.',
          );
        }
      } finally {
        client.quit();
      }
    });

    it('fails at once when the server refuses the connection before any request', async () => {
      let accepted = 0;

      const server = net.createServer((socket) => {
        accepted += 1;
        socket.resume();
        socket.end('-ERR max number of clients reached\r\n');
      });

      try {
        await new Promise<void>((resolve) => {
          server.listen(0, '127.0.0.1', resolve);
        });

        const { port } = server.address() as net.AddressInfo;
        const client = track(
          new SolidisFeaturedClient(
            mockClientOptions(port, {
              clientName: 'probe',
              maxConnectionRetries: 20,
            }),
          ),
        );

        client.on('error', () => {});

        await assert.rejects(client.connect(), (error: unknown) => {
          assert.ok(error instanceof SolidisClientError);
          assert.strictEqual(error.message, 'CLIENT SETNAME failed');
          assert.ok(error.cause instanceof Error);
          assert.ok(error.cause.cause instanceof RespError);
          assert.strictEqual(
            error.cause.cause.message,
            'ERR max number of clients reached',
          );

          return true;
        });
        assert.strictEqual(accepted, 1);

        client.quit();
      } finally {
        await new Promise((resolve) => {
          server.close(resolve);
        });
      }
    });

    it("fails at once with the server's reason when it denies the connection", async () => {
      const server = await startServer((socket) => {
        socket.end('-DENIED Redis is running in protected mode\r\n');
      });
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            clientName: 'probe',
            maxConnectionRetries: 20,
          }),
        ),
      );

      client.on('error', () => {});

      try {
        await assert.rejects(client.connect(), (error: unknown) => {
          assert.ok(error instanceof SolidisClientError);
          assert.strictEqual(error.message, 'CLIENT SETNAME failed');
          assert.ok(error.cause instanceof SolidisCommandError);
          assert.match(error.cause.message, /^\[CLIENT SETNAME\] DENIED /);

          return true;
        });

        assert.strictEqual(server.acceptedCount, 1);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('reports a handshake step answered with NOAUTH as an authentication failure', async () => {
      const server = await startServer((socket) => {
        socket.write('-NOAUTH Authentication required.\r\n');
      });

      for (const overrides of [
        { clientName: 'probe' },
        { enableReadyCheck: true },
      ]) {
        const client = track(
          new SolidisFeaturedClient(mockClientOptions(server.port, overrides)),
        );

        client.on('error', () => {});

        try {
          await assert.rejects(client.connect(), (error: unknown) => {
            assert.ok(error instanceof SolidisClientError);
            assert.strictEqual(error.message, 'Authentication failed');
            assert.ok(error.cause instanceof SolidisCommandError);
            assert.match(error.cause.message, / NOAUTH /);

            return true;
          });
        } finally {
          client.quit();
        }
      }

      await server.close();
    });

    it('never sends a request that timed out while it waited for the connection', async () => {
      const server = await startServer();
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            clientName: 'probe',
            commandTimeout: 2000,
          }),
        ),
      );

      client.on('error', () => {});

      try {
        const connecting = client.connect();

        await waitFor(() => server.received.length > 0);
        await assert.rejects(
          client.send([['SET', 'stale', 'value']], { timeout: 50 }),
          {
            name: 'SolidisClientError',
            message: 'Not connected with redis server.',
          },
        );

        const fresh = client.send([['ECHO', 'fresh']]);

        server.onData((socket) => socket.write('$5\r\nfresh\r\n'));
        server.send('+OK\r\n');

        await connecting;

        assert.deepStrictEqual(await fresh, [[Buffer.from('fresh')]]);
        assert.strictEqual(
          Buffer.concat(server.received).includes('stale'),
          false,
        );
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('stops the wait timer of a request once the connection is ready', async () => {
      const client = track(
        new SolidisClient(
          buildClientOptions({ lazyConnect: true, commandTimeout: 60_000 }),
        ),
      );
      const countTimers = () =>
        process
          .getActiveResourcesInfo()
          .filter((resource) => resource === 'Timeout').length;
      const timers = countTimers();

      try {
        assert.deepStrictEqual(await client.send([['ECHO', 'ready']]), [
          [Buffer.from('ready')],
        ]);
        assert.strictEqual(countTimers(), timers);
      } finally {
        client.quit();
      }
    });

    it('refuses a send() argument that is not an array without breaking the handshake', async () => {
      const server = await startServer(answerPong);
      const client = track(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );
      const events: string[] = [];

      client.on('ready', () => events.push('ready'));

      try {
        const broken = client
          .send(undefined as never)
          .catch((error: unknown) => error);
        const intact = client.send([['PING']]);

        await client.connect();

        assert.deepStrictEqual(await intact, [['PONG']]);

        const error = await broken;

        assert.ok(error instanceof SolidisRequesterError);
        assert.strictEqual(
          error.message,
          'Cannot send an empty or non-array command.',
        );
        await assert.rejects(client.send(null as never), {
          name: 'SolidisRequesterError',
        });
        assert.deepStrictEqual(events, ['ready']);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('settles waiting requests at once when a ready listener calls quit()', async () => {
      const server = await startServer(answerPong);
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            commandTimeout: 0,
            connectionTimeout: 600_000,
          }),
        ),
      );

      client.on('error', () => {});
      client.once('ready', () => client.quit());

      try {
        await assert.rejects(client.connect(), {
          name: 'SolidisClientError',
          message: 'The client was quit.',
        });
        await assert.rejects(client.send([['PING']]), {
          name: 'SolidisClientError',
          message: 'The client was quit.',
        });
      } finally {
        await server.close();
      }
    });

    it('settles connect() and send() at once when a ready listener quits a few microtasks later', async () => {
      const server = await startServer(answerPong);

      try {
        for (let hops = 0; hops < 5; hops += 1) {
          const client = track(
            new SolidisFeaturedClient(
              mockClientOptions(server.port, { commandTimeout: 0 }),
            ),
          );
          const outcomes = new Promise<PromiseSettledResult<unknown>[]>(
            (resolve) => {
              client.once('ready', async () => {
                for (let hop = 0; hop < hops; hop += 1) {
                  await null;
                }

                client.quit();
                resolve(
                  Promise.allSettled([
                    client.connect(),
                    client.send([['PING']]),
                  ]),
                );
              });
            },
          );

          client.on('error', () => {});
          await client.connect().catch(() => {});

          const settled = await Promise.race([
            outcomes,
            new Promise<undefined>((resolve) =>
              setTimeout(() => resolve(undefined), 1000),
            ),
          ]);

          assert.ok(settled, `still pending after ${hops} microtasks`);

          for (const outcome of settled) {
            assert.strictEqual(outcome.status, 'rejected');
            assert.strictEqual(
              outcome.status === 'rejected' && outcome.reason.message,
              'The client was quit.',
            );
          }
        }
      } finally {
        await server.close();
      }
    });

    it('settles waiting requests at once when quit() interrupts a ready-check wait', async () => {
      const server = await startServer((socket) => {
        socket.write('$11\r\nloading:1\r\n\r\n');
      });
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            enableReadyCheck: true,
            readyCheckInterval: 600_000,
            commandTimeout: 0,
            connectionTimeout: 600_000,
          }),
        ),
      );

      client.on('error', () => {});

      try {
        const connecting = client.connect().catch((error: unknown) => error);
        const waiting = client
          .send([['PING']])
          .catch((error: unknown) => error);

        await waitFor(() => server.received.length > 0);

        client.quit();

        const [connectError, sendError] = await Promise.all([
          connecting,
          waiting,
        ]);

        assert.ok(connectError instanceof SolidisClientError);
        assert.strictEqual(connectError.message, 'The client was quit.');
        assert.ok(sendError instanceof SolidisClientError);
        assert.strictEqual(sendError.message, 'The client was quit.');
        assert.strictEqual(sendError.cause, undefined);
      } finally {
        await server.close();
      }
    });

    it('accepts any listener limit without throwing', () => {
      for (const [value, limit] of [
        [10_240, 10_240],
        [0, 0],
        [-1, 0],
        [Number.NaN, 0],
        [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
      ] as const) {
        const client = track(
          new SolidisClient({
            port: 1,
            lazyConnect: true,
            debug: true,
            maxEventListenersForClient: value,
          }),
        );

        assert.strictEqual(client.getMaxListeners(), limit, String(value));

        client.quit();
      }
    });

    it('keeps waiting for the connection when a timeout exceeds the timer limit', async () => {
      const server = await startServer();
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, { clientName: 'probe' }),
        ),
      );

      client.on('error', () => {});

      try {
        const connecting = client.connect();

        await waitFor(() => server.received.length > 0);

        const pending = client.send([['ECHO', 'late']], { timeout: 2 ** 31 });

        await delay(50);

        server.onData((socket) => socket.write('$4\r\nlate\r\n'));
        server.send('+OK\r\n');

        await connecting;

        assert.deepStrictEqual(await pending, [[Buffer.from('late')]]);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('waits between ready checks when readyCheckInterval exceeds the timer limit', async () => {
      const server = await startServer((socket) => {
        socket.write('$11\r\nloading:1\r\n\r\n');
      });
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            enableReadyCheck: true,
            readyCheckInterval: 2 ** 31,
            maxReadyCheckRetries: 1,
          }),
        ),
      );

      client.on('error', () => {});

      try {
        client.connect().catch(() => {});

        await waitFor(() => server.received.length > 0);
        await delay(100);

        assert.strictEqual(
          Buffer.concat(server.received).toString().split('INFO').length - 1,
          1,
        );
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('runs commands in the order they were sent, also before the client is ready', async () => {
      const client = track(
        new SolidisFeaturedClient(buildClientOptions({ lazyConnect: true })),
      );
      const key = keyspace.key('order');

      client.on('error', () => {});

      try {
        const first = client.set(key, 'first');

        await client.connect();
        await client.set(key, 'second');
        await first;

        assert.strictEqual(await killer.get(key), 'second');
      } finally {
        await killer.del(key);
        await closeClient(client);
      }
    });

    it('runs commands held during a reconnect before those sent from a ready listener', async () => {
      const client = await createClient({ connectionRetryDelay: 10 });
      const key = keyspace.key('order-list');

      try {
        const id = await client.clientId();
        const closed = nextEvent(client, 'close');
        const fromReady = new Promise<unknown>((resolve) => {
          client.once('ready', () => {
            resolve(client.rpush(key, 'from ready'));
          });
        });

        await killer.clientKill(id);
        await closed;

        const duringOutage = client.rpush(key, 'during outage');

        await duringOutage;
        await withTimeout(fromReady, 'The command from the ready listener');

        assert.deepStrictEqual(await killer.lrange(key, 0, -1), [
          'during outage',
          'from ready',
        ]);
      } finally {
        await killer.del(key);
        await closeClient(client);
      }
    });

    it('reports a failed eager connect as an error event', async () => {
      const server = await startServer();
      const { port } = server;

      await server.close();

      const client = track(
        new SolidisFeaturedClient({
          ...mockClientOptions(port),
          lazyConnect: false,
        }),
      );
      const errors: Error[] = [];

      client.on('error', (error) => errors.push(error));

      try {
        await waitFor(() =>
          errors.some(
            (error) => error.message === 'Connection failed after 0 retries.',
          ),
        );
      } finally {
        client.quit();
      }
    });

    it('emits no error when quit() follows the constructor', async () => {
      const server = await startServer();
      const client = track(
        new SolidisFeaturedClient({
          ...mockClientOptions(server.port),
          lazyConnect: false,
        }),
      );
      const errors: unknown[] = [];

      client.on('error', (error) => errors.push(error));
      client.quit();

      await delay(50);

      assert.deepStrictEqual(errors, []);

      await server.close();
    });

    it('stays disconnected once its first connect() failed, with autoReconnect on', async () => {
      const server = await startServer((socket) => {
        socket.write('-WRONGPASS invalid username-password pair\r\n');
      });
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            autoReconnect: true,
            connectionRetryDelay: 5,
            maxConnectionRetries: 3,
            authentication: { password: 'wrong' },
          }),
        ),
      );
      const events: string[] = [];

      client.on('error', () => events.push('error'));
      client.on('reconnecting', () => events.push('reconnecting'));

      try {
        await assert.rejects(client.connect(), {
          message: 'Authentication failed',
        });

        const accepted = server.acceptedCount;

        events.length = 0;

        await delay(200);

        assert.strictEqual(server.acceptedCount, accepted);
        assert.deepStrictEqual(events, []);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('fails with Authentication failed on an AUTH error other than WRONGPASS or NOAUTH', async () => {
      const server = await startServer((socket, data) => {
        socket.write(
          data.includes('AUTH')
            ? "-ERR wrong number of arguments for 'auth' command\r\n"
            : '+OK\r\n',
        );
      });
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            authentication: { password: 'secret' },
          }),
        ),
      );

      client.on('error', () => {});

      try {
        await assert.rejects(client.connect(), (error: unknown) => {
          assert.ok(error instanceof SolidisClientError);
          assert.strictEqual(error.message, 'Authentication failed');
          assert.ok(error.cause instanceof SolidisCommandError);
          assert.match(
            error.cause.message,
            /^\[AUTH\] ERR wrong number of arguments/,
          );

          return true;
        });
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('reports a handshake failure that arrives after send() stopped waiting', async () => {
      const server = await startServer((socket, data) => {
        if (data.includes('AUTH')) {
          setTimeout(
            () => socket.write('-WRONGPASS invalid username-password pair\r\n'),
            100,
          );

          return;
        }

        socket.write('+OK\r\n');
      });
      const client = track(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            authentication: { password: 'wrong' },
          }),
        ),
      );
      const errors: Error[] = [];

      client.on('error', (error) => errors.push(error));

      try {
        await assert.rejects(
          client.send([['GET', 'k']], { timeout: 30 }),
          (error: unknown) => {
            assert.ok(error instanceof SolidisClientError);
            assert.strictEqual(
              error.message,
              'Not connected with redis server.',
            );
            assert.ok(error.cause instanceof Error);
            assert.strictEqual(
              error.cause.message,
              'Connection was not ready within 30 ms.',
            );

            return true;
          },
        );

        await waitFor(() => errors.length > 0);

        assert.ok(errors[0] instanceof SolidisClientError);
        assert.strictEqual(errors[0].message, 'Authentication failed');

        errors.length = 0;

        await assert.rejects(client.connect(), {
          message: 'Authentication failed',
        });
        assert.deepStrictEqual(errors, []);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('falls back to RESP2 only when the server cannot speak RESP3', async () => {
      const outcomes: [string, string | undefined][] = [
        ['-NOPROTO unsupported protocol version\r\n', undefined],
        [
          "-ERR unknown command 'HELLO', with args beginning with: '3'\r\n",
          undefined,
        ],
        [
          '-ERR Client names cannot contain spaces, newlines or special characters.\r\n',
          'Protocol negotiation failed',
        ],
        [
          '-NOAUTH HELLO must be called with the client already authenticated\r\n',
          'Authentication failed',
        ],
      ];

      for (const [helloReply, failure] of outcomes) {
        const server = await startServer((socket, data) => {
          socket.write(data.includes('HELLO') ? helloReply : '+OK\r\n');
        });
        const client = track(
          new SolidisFeaturedClient(
            mockClientOptions(server.port, {
              protocol: 'RESP3',
              clientName: 'my app',
            }),
          ),
        );

        client.on('error', () => {});

        try {
          if (failure === undefined) {
            await client.connect();

            assert.ok(
              Buffer.concat(server.received).includes('CLIENT'),
              helloReply,
            );
            assert.ok(
              !Buffer.concat(server.received).includes('AUTH'),
              helloReply,
            );
          } else {
            await assert.rejects(client.connect(), (error: unknown) => {
              assert.ok(error instanceof SolidisClientError);
              assert.strictEqual(error.message, failure);
              assert.ok(error.cause instanceof SolidisCommandError);
              assert.ok(error.cause.cause instanceof RespError);

              return true;
            });
          }
        } finally {
          client.quit();
          await server.close();
        }
      }
    });
  });

  describe('connection settings', () => {
    it('wraps a URI that cannot be parsed in a SolidisClientError without echoing it', () => {
      for (const uri of [
        'not a uri',
        'redis://user:secret@host:port',
        'redis://[::1',
      ]) {
        assert.throws(
          () => track(new SolidisClient({ uri, lazyConnect: true })),
          (error: unknown) => {
            assert.ok(error instanceof SolidisClientError);
            assert.strictEqual(error.message, 'Invalid URI');
            assert.strictEqual(error.cause, undefined);

            return true;
          },
        );
      }
    });

    it('reports a parsable URI for IPv6 hosts and encoded usernames', () => {
      const client = track(
        new SolidisClient({
          host: '::1',
          port: 6390,
          lazyConnect: true,
          authentication: { username: 'app user', password: 'secret' },
        }),
      );
      const parsed = new URL(client.uri);

      assert.strictEqual(client.uri, 'redis://app%20user:***@[::1]:6390');
      assert.strictEqual(parsed.hostname, '[::1]');
      assert.strictEqual(parsed.port, '6390');
      assert.strictEqual(decodeURIComponent(parsed.username), 'app user');
      assert.strictEqual(
        track(new SolidisClient({ host: 'cache', lazyConnect: true })).uri,
        'redis://cache:6379',
      );
      assert.strictEqual(
        track(
          new SolidisClient({
            host: 'cache',
            lazyConnect: true,
            authentication: { password: 'secret' },
          }),
        ).uri,
        'redis://:***@cache:6379',
      );
      assert.strictEqual(
        track(
          new SolidisClient({
            host: 'cache',
            lazyConnect: true,
            authentication: { username: 'app' },
          }),
        ).uri,
        'redis://app:***@cache:6379',
      );
      assert.strictEqual(
        track(
          new SolidisClient({
            host: 'cache',
            lazyConnect: true,
            authentication: { username: 'app\uD800' },
          }),
        ).uri,
        'redis://app%EF%BF%BD:***@cache:6379',
      );
    });
  });

  describe('runtime session state', () => {
    it('restores the user chosen with auth() after a reconnect', async () => {
      const user = `solidis-session-guards-${Date.now()}`;

      await killer.aclSetuser(user, 'reset', 'on', '>pw', '~*', '&*', '+@all');

      const client = await createClient({ connectionRetryDelay: 10 });

      try {
        assert.strictEqual(await client.auth(user, 'pw'), 'OK');
        assert.strictEqual(await client.aclWhoami(), user);

        await forceReconnect(client);

        assert.strictEqual(await client.aclWhoami(), user);
      } finally {
        await closeClient(client);
        await killer.aclDeluser(user);
      }
    });

    it('reports a background reconnect whose handshake the server refuses', async () => {
      const user = `solidis-session-guards-rotated-${Date.now()}`;

      await killer.aclSetuser(user, 'reset', 'on', '>old', '~*', '&*', '+@all');

      const client = await createClient({
        authentication: { username: user, password: 'old' },
        connectionRetryDelay: 10,
        maxConnectionRetries: 1,
      });
      const errors: Error[] = [];

      client.on('error', (error) => errors.push(error));

      try {
        const id = await client.clientId();

        await killer.aclSetuser(user, 'resetpass', '>new');
        await killer.clientKill(id);
        await waitFor(() =>
          errors.some((error) => error.message === 'Authentication failed'),
        );

        const failure = errors.find(
          (error) => error.message === 'Authentication failed',
        );

        assert.ok(failure instanceof SolidisClientError);
        assert.ok(failure.cause instanceof SolidisCommandError);
        assert.ok(failure.cause.cause instanceof RespError);
        assert.strictEqual(failure.cause.cause.code, 'WRONGPASS');

        await waitFor(() =>
          errors.some(
            (error) => error.message === 'Connection failed after 1 retries.',
          ),
        );

        const reported = errors.length;

        await delay(200);

        assert.strictEqual(
          errors.length,
          reported,
          'the client must stop reconnecting once the retry budget is spent',
        );
      } finally {
        await closeClient(client);
        await killer.aclDeluser(user);
      }
    });

    it('restores a binary password chosen with auth() after a reconnect', async () => {
      const user = `solidis-session-guards-binary-${Date.now()}`;
      const password = Buffer.from([0x70, 0xff, 0xfe, 0x77]);

      await killer.send([
        [
          'ACL',
          'SETUSER',
          user,
          'reset',
          'on',
          Buffer.concat([Buffer.from('>'), password]),
          '~*',
          '&*',
          '+@all',
        ],
      ]);

      const client = await createClient({ connectionRetryDelay: 10 });

      try {
        assert.strictEqual(await client.auth(user, password), 'OK');
        assert.strictEqual(await client.aclWhoami(), user);

        await forceReconnect(client);

        assert.strictEqual(await client.aclWhoami(), user);
      } finally {
        await closeClient(client);
        await killer.aclDeluser(user);
      }
    });

    it('forgets channels whose restore the server refuses, keeping later replies in order', async () => {
      const user = `solidis-session-guards-pubsub-${Date.now()}`;
      const channel = keyspace.key('refused-restore', 'channel');
      const key = keyspace.key('refused-restore', 'list');

      await killer.send([
        ['ACL', 'SETUSER', user, 'reset', 'on', '>secret', '~*', '&*', '+@all'],
        ['RPUSH', key, 'message', channel, 'payload'],
      ]);

      const client = await createClient({
        authentication: { username: user, password: 'secret' },
        connectionRetryDelay: 10,
      });
      const errors: Error[] = [];
      const messages: unknown[] = [];

      client.on('error', (error) => errors.push(error));
      client.on('message', (...parameters) => messages.push(parameters));

      try {
        const id = await client.clientId();
        const reconnected = nextEvent(client, 'reconnected');

        await client.subscribe(channel);
        await killer.send([['ACL', 'SETUSER', user, '-@pubsub']]);
        await killer.clientKill(id);
        await reconnected;

        const failures = () =>
          errors.filter(
            (error) => error.message === 'Failed to restore subscriptions',
          );
        const [failure] = failures();

        assert.ok(failure instanceof SolidisClientError);
        assert.ok(failure.cause instanceof RespError);
        assert.strictEqual(failure.cause.code, 'NOPERM');
        assert.deepStrictEqual(
          await client.send([
            ['LRANGE', key, '0', '-1'],
            ['ECHO', 'next'],
          ]),
          [
            [
              [
                Buffer.from('message'),
                Buffer.from(channel),
                Buffer.from('payload'),
              ],
            ],
            [Buffer.from('next')],
          ],
        );
        assert.deepStrictEqual(messages, []);

        await killer.send([['ACL', 'SETUSER', user, '+@pubsub']]);
        await forceReconnect(client);

        assert.strictEqual(await killer.publish(channel, 'lost'), 0);
        assert.strictEqual(failures().length, 1);
      } finally {
        await closeClient(client);
        await killer.aclDeluser(user);
        await killer.del(key);
      }
    });

    it('returns to the default session after RESET, also across a reconnect', async () => {
      const client = await createClient({
        protocol: SolidisProtocols.RESP3,
        connectionRetryDelay: 10,
      });
      const key = keyspace.key('reset');
      const messages: unknown[] = [];

      client.on('message', (...parameters) => messages.push(parameters));

      try {
        await client.select(4);
        await client.set(key, 'four');
        await client.subscribe(key);

        assert.strictEqual(await client.reset(), 'RESET');
        assert.strictEqual(await client.get(key), null);

        const [[raw]] = await client.send([['HGETALL', key]]);

        assert.ok(Array.isArray(raw), 'RESET returns the connection to RESP2');

        await forceReconnect(client);
        await killer.publish(key, 'ignored');

        assert.strictEqual(await client.get(key), null);
        assert.deepStrictEqual(messages, []);
      } finally {
        await killer.select(4);
        await killer.del(key);
        await killer.select(0);
        await closeClient(client);
      }
    });

    it('keeps the database selected inside a transaction after a reconnect', async () => {
      const client = await createClient({ connectionRetryDelay: 10 });
      const key = keyspace.key('transaction-select');

      try {
        const transaction = client.multi();

        transaction.select(5);
        transaction.set(key, 'five');

        assert.deepStrictEqual(await transaction.exec(), ['OK', 'OK']);

        await forceReconnect(client);

        assert.strictEqual(await client.get(key), 'five');
      } finally {
        await client.select(5);
        await client.del(key);
        await closeClient(client);
      }
    });

    it('refuses the commands of a MULTI that a reconnect dropped', async () => {
      const client = await createClient({ connectionRetryDelay: 10 });
      const key = keyspace.key('lost-multi');

      try {
        const id = await client.clientId();
        const reconnected = nextEvent(client, 'reconnected');

        assert.deepStrictEqual(await client.send([['MULTI']]), [['OK']]);

        await killer.clientKill(id);
        await reconnected;
        await assert.rejects(client.send([['INCR', key]]), {
          name: 'SolidisRequesterError',
          message: 'INCR is refused after a lost MULTI.',
        });

        assert.deepStrictEqual(await client.send([['EXEC']]), [[null]]);
        assert.strictEqual(await killer.get(key), null);
        assert.strictEqual(await client.incr(key), 1);
      } finally {
        await killer.del(key);
        await closeClient(client);
      }
    });

    it('restores a protocol chosen with hello() after a reconnect, until RESET', async () => {
      const client = await createClient({
        protocol: SolidisProtocols.RESP2,
        connectionRetryDelay: 10,
      });
      const key = keyspace.key('protocol');

      try {
        await killer.send([['HSET', key, 'field', 'value']]);
        await client.hello(SolidisProtocols.RESP3);
        await forceReconnect(client);

        const [[map]] = await client.send([['HGETALL', key]]);

        assert.ok(map instanceof Map);
        assert.strictEqual(await client.reset(), 'RESET');

        await forceReconnect(client);

        const [[array]] = await client.send([['HGETALL', key]]);

        assert.ok(Array.isArray(array));
      } finally {
        await killer.del(key);
        await closeClient(client);
      }
    });

    it('authenticates a user whose password is empty', async () => {
      const user = `solidis-session-guards-empty-${Date.now()}`;

      await killer.aclSetuser(
        user,
        'reset',
        'on',
        'nopass',
        '~*',
        '&*',
        '+@all',
      );

      const client = await createClient({
        authentication: { username: user, password: '' },
      });

      try {
        assert.strictEqual(await client.aclWhoami(), user);
        assert.strictEqual(await client.auth(user, ''), 'OK');
      } finally {
        await closeClient(client);
        await killer.aclDeluser(user);
      }
    });

    it('aborts a transaction whose WATCH was lost in a reconnect', async () => {
      const client = await createClient({ connectionRetryDelay: 10 });
      const key = keyspace.key('watched-balance');

      try {
        await killer.set(key, '100');
        await client.watch(key);
        await forceReconnect(client);
        await killer.set(key, '500');

        const transaction = client.multi();

        transaction.set(key, '90');

        assert.strictEqual(await transaction.exec(), null);
        assert.strictEqual(await killer.get(key), '500');

        const retry = client.multi();

        retry.set(key, '91');

        assert.deepStrictEqual(await retry.exec(), ['OK']);
        assert.strictEqual(await killer.get(key), '91');
      } finally {
        await closeClient(client);
      }
    });

    it('keeps a lost WATCH through command names that only read as UNWATCH or RESET', async () => {
      const client = await createClient({ connectionRetryDelay: 10 });
      const key = keyspace.key('unknown-unwatch');

      try {
        for (const name of ['UNWATCH\0x', 'RESET\0', 'reſet', 'unwatcH ']) {
          await killer.set(key, '100');
          await client.watch(key);
          await forceReconnect(client);
          await killer.set(key, '500');

          const reply = await client.send([[name]]).then(
            ([[value]]) => value,
            (error: unknown) => error,
          );

          assert.ok(
            name === 'unwatcH '
              ? reply instanceof RespError
              : reply instanceof SolidisRequesterError,
            name,
          );

          const transaction = client.multi();

          transaction.set(key, '90');

          assert.strictEqual(await transaction.exec(), null, name);
          assert.strictEqual(await killer.get(key), '500');
        }
      } finally {
        await closeClient(client);
      }
    });

    it('keeps a lost WATCH through an EXEC or DISCARD sent outside a transaction', async () => {
      const client = await createClient({ connectionRetryDelay: 10 });
      const key = keyspace.key('stray-watch');

      try {
        for (const stray of ['DISCARD', 'EXEC']) {
          await killer.set(key, '100');
          await client.watch(key);
          await forceReconnect(client);
          await killer.set(key, '500');

          const [[reply]] = await client.send([[stray]]);

          assert.ok(reply instanceof RespError);
          assert.strictEqual(reply.message, `ERR ${stray} without MULTI`);

          const transaction = client.multi();

          transaction.set(key, '90');

          assert.strictEqual(await transaction.exec(), null, stray);
          assert.strictEqual(await killer.get(key), '500');
        }
      } finally {
        await closeClient(client);
      }
    });

    it('keeps a WATCH lost while an EXEC or DISCARD outside a transaction was in flight', async () => {
      for (const stray of ['DISCARD', 'EXEC']) {
        const received: string[] = [];
        const replies: Record<string, string> = {
          WATCH: '+OK\r\n',
          MULTI: '+OK\r\n',
          SET: '+QUEUED\r\n',
          EXEC: '*1\r\n+OK\r\n',
          DISCARD: '+OK\r\n',
        };
        const server = await startServer((socket, data) => {
          for (const [, name] of data
            .toString()
            .matchAll(/\*\d+\r\n\$\d+\r\n([A-Z]+)\r\n/g)) {
            received.push(name);

            if (received.length === 2) {
              socket.destroy();

              return;
            }

            socket.write(replies[name]);
          }
        });
        const client = track(
          new SolidisFeaturedClient(mockClientOptions(server.port)),
        );

        try {
          await client.connect();
          await client.watch('key');
          await assert.rejects(client.send([[stray]]), {
            name: 'SolidisConnectionError',
          });

          const transaction = client.multi();

          transaction.set('key', 'value');

          assert.strictEqual(await transaction.exec(), null, stray);
          assert.deepStrictEqual(received, [
            'WATCH',
            stray,
            'MULTI',
            'SET',
            'DISCARD',
          ]);
        } finally {
          client.quit();
          await server.close();
        }
      }
    });

    it('keeps a WATCH lost while another command was in flight', async () => {
      const received: string[] = [];
      const replies: Record<string, string> = {
        WATCH: '+OK\r\n',
        MULTI: '+OK\r\n',
        SET: '+QUEUED\r\n',
        EXEC: '*1\r\n+OK\r\n',
        DISCARD: '+OK\r\n',
      };
      const server = await startServer((socket, data) => {
        for (const [, name] of data
          .toString()
          .matchAll(/\*\d+\r\n\$\d+\r\n([A-Z]+)\r\n/g)) {
          received.push(name);

          if (received.length === 2) {
            socket.destroy();

            return;
          }

          socket.write(replies[name]);
        }
      });
      const client = track(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      try {
        await client.connect();
        await client.watch('key');
        await assert.rejects(client.get('key'), {
          name: 'SolidisConnectionError',
        });

        const transaction = client.multi();

        transaction.set('key', 'value');

        assert.strictEqual(await transaction.exec(), null);
        assert.deepStrictEqual(received, [
          'WATCH',
          'GET',
          'MULTI',
          'SET',
          'DISCARD',
        ]);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('emits RESP2 client-side caching invalidations as push events', async () => {
      const listener = await createClient({ protocol: SolidisProtocols.RESP2 });
      const tracked = await createClient({ protocol: SolidisProtocols.RESP2 });
      const key = keyspace.key('tracked');
      const pushes: RespPush[] = [];
      const messages: unknown[] = [];

      listener.on('push', (push) => pushes.push(push));
      listener.on('message', (...parameters) => messages.push(parameters));

      try {
        const redirect = await listener.clientId();

        await listener.subscribe('__redis__:invalidate');
        await tracked.clientTracking('ON', { redirect });
        await tracked.get(key);
        await killer.set(key, 'changed');
        await waitFor(() => pushes.length > 0);

        assert.ok(pushes[0] instanceof RespPush);
        assert.deepStrictEqual(
          [...pushes[0]],
          [Buffer.from('invalidate'), [Buffer.from(key)]],
        );
        assert.deepStrictEqual(messages, []);
      } finally {
        await closeClient(tracked);
        await closeClient(listener);
      }
    });
  });
});

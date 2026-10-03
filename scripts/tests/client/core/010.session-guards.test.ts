/** Session guards: reconnect pacing, listener re-entrancy, handshake sessions and runtime session state. */

import assert from 'node:assert/strict';
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
} from '../../../../sources/index.ts';
import {
  closeClient,
  createClient,
  createKeyspace,
  delay,
  MockRedisServer,
  mockClientOptions,
  waitFor,
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
    const reconnected = new Promise<void>((resolve) => {
      client.once('reconnected', () => resolve());
    });

    await killer.clientKill(id);
    await reconnected;
  }

  describe('reconnect pacing', () => {
    it('backs off reconnects to a server that drops every connection right after accepting it', async (context) => {
      context.mock.method(Math, 'random', () => 1);

      const server = await startServer();
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          autoReconnect: true,
          connectionRetryDelay: 20,
          maxConnectionRetryDelay: 80,
          maxConnectionRetries: 100,
        }),
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

    it('gives up a background reconnect after maxConnectionRetries and reports it', async () => {
      const server = await startServer();
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          autoReconnect: true,
          maxConnectionRetries: 2,
          connectionRetryDelay: 5,
          maxConnectionRetryDelay: 10,
        }),
      );
      const errors: Error[] = [];
      const attempts: number[] = [];

      client.on('error', (error) => errors.push(error));
      client.on('reconnecting', (attempt) => attempts.push(attempt));

      try {
        await client.connect();
        await server.close();
        await waitFor(() =>
          errors.some(
            (error) => error.message === 'Connection failed after 2 retries.',
          ),
        );
        await delay(100);

        assert.strictEqual(attempts.length, 3);

        const giveUp = errors.at(-1);

        assert.ok(giveUp instanceof SolidisConnectionError);
        assert.strictEqual(
          giveUp.message,
          'Connection failed after 2 retries.',
        );
      } finally {
        client.quit();
      }
    });

    it('gives up on a server that drops every connection right after accepting it', async () => {
      const server = await startServer();
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          autoReconnect: true,
          maxConnectionRetries: 2,
          connectionRetryDelay: 5,
          maxConnectionRetryDelay: 10,
        }),
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
            (error) => error.message === 'Connection failed after 2 retries.',
          ),
        );
        await delay(100);

        assert.strictEqual(server.acceptedCount - accepted, 3);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('announces every reconnect attempt, including the first one after a drop', async () => {
      const server = await startServer(answerPong);
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          autoReconnect: true,
          connectionRetryDelay: 10,
          maxConnectionRetryDelay: 10,
        }),
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
    it('stops reconnecting when quit() runs inside a reconnecting listener', async () => {
      const server = await startServer(answerPong);
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          autoReconnect: true,
          connectionRetryDelay: 10,
        }),
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

    it('starts one attempt when error and reconnecting listeners send commands and connect', async () => {
      const server = await startServer(answerPong);
      const { port } = server;
      const client = new SolidisFeaturedClient(
        mockClientOptions(port, {
          autoReconnect: true,
          connectionRetryDelay: 20,
          maxConnectionRetryDelay: 40,
          maxConnectionRetries: 100,
          commandTimeout: 3000,
        }),
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
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          autoReconnect: true,
          connectionRetryDelay: 10,
        }),
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

    it('keeps the session working when ready and close listeners throw', async () => {
      const server = await startServer(answerPong);
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          autoReconnect: true,
          connectionRetryDelay: 10,
        }),
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

    it('isolates debug listeners from the requester', async () => {
      const server = await startServer(answerPong);
      const warnings: Error[] = [];
      const onWarning = (warning: Error) => warnings.push(warning);
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, { debug: true }),
      );
      const quitter = new SolidisFeaturedClient(
        mockClientOptions(server.port, { debug: true }),
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
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          clientName: 'app',
          maxConnectionRetries: 2,
          connectionRetryDelay: 10,
        }),
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

    it('rejects with the lost handshake connection once no retries are left', async () => {
      const server = await startSetnameServer(5);
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, { clientName: 'app' }),
      );
      const events: string[] = [];

      client.on('error', () => {});
      client.on('ready', () => events.push('ready'));

      try {
        await assert.rejects(client.connect(), {
          name: 'SolidisConnectionError',
          message: 'Connection closed during the handshake.',
        });
        assert.deepStrictEqual(events, []);
        assert.strictEqual(server.acceptedCount, 1);
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('never becomes ready after quit() interrupts the handshake', async () => {
      const server = await startServer();
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, { clientName: 'app' }),
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

        await assert.rejects(connecting, SolidisConnectionError);
        await delay(50);

        assert.deepStrictEqual(events, ['connect', 'end']);
      } finally {
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
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          enableReadyCheck: true,
          readyCheckInterval: 50,
        }),
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

    it('reports a failed eager connect as an error event', async () => {
      const server = await startServer();
      const { port } = server;

      await server.close();

      const client = new SolidisFeaturedClient({
        ...mockClientOptions(port),
        lazyConnect: false,
      });
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
      const client = new SolidisFeaturedClient({
        ...mockClientOptions(server.port),
        lazyConnect: false,
      });
      const errors: unknown[] = [];

      client.on('error', (error) => errors.push(error));
      client.quit();

      await delay(50);

      assert.deepStrictEqual(errors, []);

      await server.close();
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
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          authentication: { password: 'wrong' },
        }),
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
        const client = new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            protocol: 'RESP3',
            clientName: 'my app',
          }),
        );

        client.on('error', () => {});

        try {
          if (failure === undefined) {
            await client.connect();

            assert.ok(
              Buffer.concat(server.received).includes('CLIENT'),
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
          () => new SolidisClient({ uri, lazyConnect: true }),
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
      const client = new SolidisClient({
        host: '::1',
        port: 6390,
        lazyConnect: true,
        authentication: { username: 'app user', password: 'secret' },
      });
      const parsed = new URL(client.uri);

      assert.strictEqual(client.uri, 'redis://app%20user:***@[::1]:6390');
      assert.strictEqual(parsed.hostname, '[::1]');
      assert.strictEqual(parsed.port, '6390');
      assert.strictEqual(decodeURIComponent(parsed.username), 'app user');
      assert.strictEqual(
        new SolidisClient({ host: '127.0.0.1', lazyConnect: true }).uri,
        'redis://127.0.0.1:6379',
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

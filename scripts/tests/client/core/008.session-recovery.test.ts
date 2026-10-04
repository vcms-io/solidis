/** Session state across handshakes, reconnects and quits; blocking commands against commandTimeout. */

import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../../sources/client/featured.ts';
import {
  commandsToBuffer,
  RespError,
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
  detectServerCapabilities,
  MockRedisServer,
  mockClientOptions,
  range,
  waitFor,
} from '../../utils/index.ts';

import type { FeaturedClient } from '../../utils/index.ts';

async function listenPong(port = 0) {
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
    socket.on('data', () => socket.write('+PONG\r\n'));
  });

  await new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', resolve);
  });

  return {
    port: (server.address() as net.AddressInfo).port,
    close() {
      for (const socket of sockets) {
        socket.destroy();
      }

      return new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}

function nextEvent(client: FeaturedClient, eventName: 'close' | 'reconnected') {
  return new Promise<void>((resolve) => {
    client.once(eventName, () => resolve());
  });
}

describe('session-recovery', () => {
  const keyspace = createKeyspace('session-recovery');

  let killer: FeaturedClient;
  let isAtLeast7 = false;

  before(async () => {
    killer = await createClient();
    isAtLeast7 = (await detectServerCapabilities(killer)).atLeast(7, 0);
  });

  after(async () => {
    await closeClient(killer);
  });

  async function forceReconnect(client: FeaturedClient, id: number) {
    const reconnected = nextEvent(client, 'reconnected');

    await killer.clientKill(id);
    await reconnected;
  }

  describe('handshake', () => {
    async function startHandshakeServer(helloReply: string) {
      const server = new MockRedisServer();

      server.onData((socket, data) => {
        socket.write(data.includes('HELLO') ? helloReply : '+OK\r\n');
      });

      await server.listen();

      return server;
    }

    function receivedCommands(server: MockRedisServer) {
      return Buffer.concat(server.received).toString();
    }

    it('authenticates and names the connection with a single HELLO', async () => {
      const server = await startHandshakeServer(
        '%2\r\n+server\r\n+redis\r\n+proto\r\n:3\r\n',
      );
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          protocol: 'RESP3',
          clientName: 'solidis',
          authentication: { username: 'alice', password: 'secret' },
        }),
      );

      try {
        await client.connect();

        assert.strictEqual(
          receivedCommands(server),
          commandsToBuffer([
            ['HELLO', '3', 'AUTH', 'alice', 'secret', 'SETNAME', 'solidis'],
          ]).toString(),
        );
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('fails the handshake without falling back when HELLO is refused for bad credentials', async () => {
      const server = await startHandshakeServer(
        '-WRONGPASS invalid username-password pair or user is disabled.\r\n',
      );
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          protocol: 'RESP3',
          authentication: { password: 'wrong' },
        }),
      );

      client.on('error', () => {});

      try {
        await assert.rejects(client.connect(), (error: unknown) => {
          assert.ok(error instanceof SolidisClientError);
          assert.strictEqual(error.message, 'Authentication failed');
          assert.ok(error.cause instanceof SolidisCommandError);
          assert.ok(error.cause.cause instanceof RespError);
          assert.strictEqual(error.cause.cause.code, 'WRONGPASS');
          assert.strictEqual(`${error.cause.message}`.includes('wrong'), false);

          return true;
        });
        assert.strictEqual(
          receivedCommands(server),
          commandsToBuffer([
            ['HELLO', '3', 'AUTH', 'default', 'wrong'],
          ]).toString(),
        );
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('falls back to AUTH and CLIENT SETNAME when the server does not know HELLO', async () => {
      const server = await startHandshakeServer(
        "-ERR unknown command 'HELLO'\r\n",
      );
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          protocol: 'RESP3',
          clientName: 'solidis',
          authentication: { password: 'secret' },
        }),
      );

      client.on('error', () => {});

      try {
        await client.connect();

        assert.strictEqual(
          receivedCommands(server),
          commandsToBuffer([
            ['HELLO', '3', 'AUTH', 'default', 'secret', 'SETNAME', 'solidis'],
            ['AUTH', 'default', 'secret'],
            ['CLIENT', 'SETNAME', 'solidis'],
          ]).toString(),
        );
      } finally {
        client.quit();
        await server.close();
      }
    });

    it('rejects RESP3 connects with bad credentials on a real server', async () => {
      await assert.rejects(
        createClient({
          protocol: 'RESP3',
          authentication: { username: 'solidis-nobody', password: 'wrong' },
        }),
        (error: unknown) =>
          error instanceof SolidisClientError &&
          error.message === 'Authentication failed',
      );
    });
  });

  describe('database', () => {
    it('runs commands issued before ready on the configured database', async () => {
      const key = keyspace.key('database-race');
      const eager = new SolidisFeaturedClient(
        buildClientOptions({ database: 3 }),
      );
      const lazy = new SolidisFeaturedClient(
        buildClientOptions({ database: 4, lazyConnect: true }),
      );

      eager.on('error', () => {});
      lazy.on('error', () => {});

      const verifiers = await Promise.all(
        [0, 3, 4].map((database) => createClient({ database })),
      );

      try {
        assert.deepStrictEqual(
          await Promise.all([eager.set(key, 'three'), lazy.set(key, 'four')]),
          ['OK', 'OK'],
        );
        assert.deepStrictEqual(
          await Promise.all(verifiers.map((verifier) => verifier.get(key))),
          [null, 'three', 'four'],
        );
      } finally {
        await Promise.all(
          [eager, lazy, ...verifiers].map((client) => closeClient(client)),
        );
      }
    });

    it('restores a runtime SELECT after a reconnect', async () => {
      const client = await createClient({ connectionRetryDelay: 10 });
      const key = keyspace.key('runtime-select');

      try {
        assert.strictEqual(await client.select(6), 'OK');

        await client.set(key, 'six');
        await forceReconnect(client, await client.clientId());

        assert.strictEqual(await client.get(key), 'six');
      } finally {
        await closeClient(client);
      }
    });

    it('returns to the configured database when database recovery is off', async () => {
      const client = await createClient({
        database: 2,
        connectionRetryDelay: 10,
        autoRecovery: { database: false },
      });
      const key = keyspace.key('configured-select');

      try {
        await client.set(key, 'two');
        await client.select(7);

        assert.strictEqual(await client.get(key), null);

        await forceReconnect(client, await client.clientId());

        assert.strictEqual(await client.get(key), 'two');
      } finally {
        await closeClient(client);
      }
    });
  });

  describe('subscriptions', () => {
    for (const protocol of [SolidisProtocols.RESP2, SolidisProtocols.RESP3]) {
      it(`restores channel, pattern and shard subscriptions over ${protocol}`, async (context) => {
        if (!isAtLeast7) {
          context.skip('sharded pub/sub requires Redis 7.0+');

          return;
        }

        const subscriber = await createClient({
          protocol,
          connectionRetryDelay: 10,
        });
        const channel = keyspace.key(protocol, 'channel');
        const pattern = `${keyspace.namespace}:${protocol}:pattern:*`;
        const patternChannel = keyspace.key(protocol, 'pattern', 'hit');
        const shard = keyspace.key(protocol, 'shard');
        const received: string[] = [];

        subscriber.on('message', (_channel, message) => {
          received.push(`message:${message}`);
        });
        subscriber.on('pmessage', (_pattern, _channel, message) => {
          received.push(`pmessage:${message}`);
        });
        subscriber.on('smessage', (_channel, message) => {
          received.push(`smessage:${message}`);
        });

        try {
          const id = await subscriber.clientId();

          await subscriber.subscribe(channel);
          await subscriber.psubscribe(pattern);
          await subscriber.ssubscribe(shard);
          await forceReconnect(subscriber, id);

          assert.strictEqual(await killer.publish(channel, 'channel'), 1);
          assert.strictEqual(
            await killer.publish(patternChannel, 'pattern'),
            1,
          );
          assert.strictEqual(await killer.spublish(shard, 'shard'), 1);

          await waitFor(() => received.length === 3);

          assert.deepStrictEqual(received.sort(), [
            'message:channel',
            'pmessage:pattern',
            'smessage:shard',
          ]);
        } finally {
          await closeClient(subscriber);
        }
      });
    }

    it('restores a channel whose name is not valid UTF-8', async () => {
      const subscriber = await createClient({ connectionRetryDelay: 10 });
      const channel = Buffer.concat([
        Buffer.from(keyspace.key('binary')),
        Buffer.from([0xff, 0xfe]),
      ]);
      const received: string[] = [];

      subscriber.on('message', (_channel, message) => {
        received.push(String(message));
      });

      try {
        const id = await subscriber.clientId();

        await subscriber.send([['SUBSCRIBE', channel]]);
        await forceReconnect(subscriber, id);

        assert.deepStrictEqual(
          await killer.send([['PUBLISH', channel, 'restored']]),
          [[1]],
        );

        await waitFor(() => received.length === 1);

        assert.deepStrictEqual(received, ['restored']);
      } finally {
        await closeClient(subscriber);
      }
    });

    it('restores only the subscription kinds enabled in autoRecovery', async () => {
      const subscriber = await createClient({
        connectionRetryDelay: 10,
        autoRecovery: { psubscribe: false },
      });
      const channel = keyspace.key('partial', 'channel');
      const pattern = `${keyspace.namespace}:partial:pattern:*`;

      try {
        const id = await subscriber.clientId();

        await subscriber.subscribe(channel);
        await subscriber.psubscribe(pattern);
        await forceReconnect(subscriber, id);

        assert.strictEqual(await killer.publish(channel, 'kept'), 1);
        assert.strictEqual(
          await killer.publish(keyspace.key('partial', 'pattern', 'x'), 'lost'),
          0,
        );
      } finally {
        await closeClient(subscriber);
      }
    });

    async function startSubscriptionServer(
      respond: (subscribeCount: number, socket: net.Socket) => void,
    ) {
      const server = new MockRedisServer();
      let subscribeCount = 0;

      server.onData((socket, data) => {
        if (data.includes('SUBSCRIBE')) {
          subscribeCount += 1;
          respond(subscribeCount, socket);

          return;
        }

        socket.write('*3\r\n$7\r\nmessage\r\n$1\r\nx\r\n$4\r\ndata\r\n');
      });

      await server.listen();

      return server;
    }

    const confirmation = '*3\r\n$9\r\nsubscribe\r\n$1\r\nx\r\n:1\r\n';

    for (const rejectOnPartialPipelineError of [false, true]) {
      it(`forgets subscriptions the server refuses to restore with rejectOnPartialPipelineError ${rejectOnPartialPipelineError}`, async () => {
        const server = await startSubscriptionServer(
          (subscribeCount, socket) => {
            socket.write(
              subscribeCount === 1
                ? confirmation
                : "-NOPERM this user has no permissions to access the 'x' channel\r\n",
            );
          },
        );
        const client = new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            autoReconnect: true,
            connectionRetryDelay: 10,
            maxConnectionRetries: 5,
            rejectOnPartialPipelineError,
          }),
        );
        const errors: Error[] = [];
        const messages: unknown[] = [];

        client.on('error', (error) => errors.push(error));
        client.on('message', (...parameters) => messages.push(parameters));

        try {
          await client.connect();
          await client.subscribe('x');

          const reconnected = nextEvent(client, 'reconnected');

          server.destroySockets();

          const error = await waitFor(() =>
            errors.find(
              (candidate) =>
                candidate.message === 'Failed to restore subscriptions',
            ),
          );

          await reconnected;

          assert.ok(error instanceof SolidisClientError);
          assert.ok(error.cause instanceof RespError);
          assert.strictEqual(error.cause.code, 'NOPERM');
          assert.strictEqual(
            error.cause.message,
            "NOPERM this user has no permissions to access the '***' channel",
          );
          assert.deepStrictEqual(
            await client.send([['LRANGE', 'x', '0', '-1']]),
            [[[Buffer.from('message'), Buffer.from('x'), Buffer.from('data')]]],
          );
          assert.deepStrictEqual(messages, []);
        } finally {
          client.quit();
          await server.close();
        }
      });
    }

    it('does not report ready when the connection drops while restoring', async () => {
      const server = await startSubscriptionServer((subscribeCount, socket) => {
        if (subscribeCount === 2) {
          socket.destroy();

          return;
        }

        socket.write(confirmation);
      });
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          autoReconnect: true,
          connectionRetryDelay: 10,
          maxConnectionRetries: 5,
        }),
      );
      const events: string[] = [];

      client.on('error', () => {});

      for (const eventName of ['ready', 'close', 'reconnected'] as const) {
        client.on(eventName, () => events.push(eventName));
      }

      try {
        await client.connect();
        await client.subscribe('x');

        const reconnected = nextEvent(client, 'reconnected');

        server.destroySockets();

        await reconnected;
        await delay(50);

        assert.deepStrictEqual(events, [
          'ready',
          'close',
          'close',
          'ready',
          'reconnected',
        ]);
        assert.deepStrictEqual(await client.send([['SUBSCRIBE', 'x']]), [
          [[Buffer.from('subscribe'), Buffer.from('x'), 1]],
        ]);
      } finally {
        client.quit();
        await server.close();
      }
    });
  });

  describe('outages', () => {
    it('waits for readiness without a deadline when commandTimeout is disabled', async () => {
      const client = new SolidisFeaturedClient(
        buildClientOptions({ lazyConnect: true, commandTimeout: 0 }),
      );

      client.on('error', () => {});

      try {
        assert.strictEqual(await client.ping(), 'PONG');
      } finally {
        await closeClient(client);
      }
    });

    it('holds commands sent during an outage until the session is ready again', async () => {
      const client = await createClient({ connectionRetryDelay: 10 });
      const key = keyspace.key('outage');

      try {
        const closed = nextEvent(client, 'close');

        await killer.clientKill(await client.clientId());
        await closed;

        assert.deepStrictEqual(
          await Promise.all(range(20).map(() => client.incr(key))),
          range(20).map((index) => index + 1),
        );
      } finally {
        await closeClient(client);
      }
    });

    it('rejects commands when the server stays away longer than commandTimeout', async () => {
      const server = await listenPong();
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          autoReconnect: true,
          commandTimeout: 150,
          connectionRetryDelay: 20,
          maxConnectionRetries: 100,
        }),
      );

      client.on('error', () => {});

      try {
        await client.connect();

        assert.strictEqual(await client.ping(), 'PONG');

        const closed = nextEvent(client, 'close');

        await server.close();
        await closed;

        const startedAt = Date.now();

        await assert.rejects(client.ping(), (error: unknown) => {
          assert.ok(error instanceof SolidisClientError);
          assert.strictEqual(error.message, 'Not connected with redis server.');
          assert.ok(error.cause instanceof SolidisRequesterError);
          assert.strictEqual(
            error.cause.message,
            'Connection was not ready within 150 ms.',
          );

          return true;
        });
        assert.ok(Date.now() - startedAt >= 140);

        const quickStartedAt = Date.now();

        await assert.rejects(
          client.send([['PING']], { timeout: 40 }),
          (error: unknown) => {
            assert.ok(error instanceof SolidisClientError);
            assert.ok(error.cause instanceof SolidisRequesterError);
            assert.strictEqual(
              error.cause.message,
              'Connection was not ready within 40 ms.',
            );

            return true;
          },
        );
        assert.ok(Date.now() - quickStartedAt < 140);
      } finally {
        client.quit();
      }
    });

    it('rejects commands once the retry budget runs out during an outage', async () => {
      const server = await listenPong();
      const client = new SolidisFeaturedClient(
        mockClientOptions(server.port, {
          autoReconnect: true,
          commandTimeout: 5000,
          connectionRetryDelay: 20,
          maxConnectionRetries: 0,
        }),
      );

      client.on('error', () => {});

      try {
        await client.connect();

        const closed = nextEvent(client, 'close');

        await server.close();
        await closed;

        await assert.rejects(client.ping(), (error: unknown) => {
          assert.ok(error instanceof SolidisClientError);
          assert.strictEqual(error.message, 'Not connected with redis server.');
          assert.ok(error.cause instanceof SolidisConnectionError);
          assert.strictEqual(
            error.cause.message,
            'Connection failed after 0 retries.',
          );

          return true;
        });
      } finally {
        client.quit();
      }
    });

    it('reconnects with growing delays once the server returns and resets the backoff', async (context) => {
      context.mock.method(Math, 'random', () => 1);

      let server = await listenPong();
      const { port } = server;
      const client = new SolidisFeaturedClient(
        mockClientOptions(port, {
          autoReconnect: true,
          connectionRetryDelay: 20,
          maxConnectionRetryDelay: 80,
          maxConnectionRetries: 100,
        }),
      );
      const delays: number[] = [];
      const events: string[] = [];

      client.on('error', () => {});
      client.on('reconnecting', (_attempt, delay) => delays.push(delay));

      for (const eventName of ['close', 'ready', 'reconnected'] as const) {
        client.on(eventName, () => events.push(eventName));
      }

      try {
        await client.connect();

        const reconnected = nextEvent(client, 'reconnected');

        await server.close();
        await waitFor(() => delays.length >= 4, { timeout: 5000 });

        server = await listenPong(port);

        await reconnected;

        assert.deepStrictEqual(delays.slice(0, 4), [20, 40, 80, 80]);
        assert.deepStrictEqual(events, [
          'ready',
          'close',
          'ready',
          'reconnected',
        ]);
        assert.strictEqual(await client.ping(), 'PONG');

        delays.length = 0;

        await delay(100);
        await server.close();
        await waitFor(() => delays.length >= 3, { timeout: 5000 });

        assert.deepStrictEqual(delays.slice(0, 3), [0, 20, 40]);
      } finally {
        client.quit();
        await server.close();
      }
    });
  });

  describe('quit', () => {
    it('rejects in-flight commands on quit and every command afterwards', async () => {
      const client = await createClient();
      const key = keyspace.key('quit');
      const id = await client.clientId();
      const blocked = client.blpop([key], 0);
      const queued = client.get(key);

      await waitFor(async () =>
        (await killer.clientList())
          .split('\n')
          .some(
            (line) =>
              line.startsWith(`id=${id} `) && line.includes('cmd=blpop'),
          ),
      );

      client.quit();

      for (const pending of [blocked, queued]) {
        await assert.rejects(pending, {
          name: 'SolidisClientError',
          message: 'The client was quit.',
        });
      }

      await assert.rejects(client.get(key), (error: unknown) => {
        assert.ok(error instanceof SolidisClientError);
        assert.strictEqual(error.message, 'The client was quit.');
        assert.strictEqual(error.cause, undefined);

        return true;
      });
      await assert.rejects(client.connect(), {
        message: 'The client was quit.',
      });

      assert.strictEqual(await killer.rpush(key, 'kept'), 1);
      assert.strictEqual(await killer.llen(key), 1);
    });
  });

  describe('blocking commands', () => {
    it('lets blocking commands outlive commandTimeout by their own timeout', async () => {
      const client = await createClient({ commandTimeout: 200 });
      const stream = keyspace.key('blocking', 'stream');

      try {
        let startedAt = Date.now();

        assert.strictEqual(
          await client.blpop([keyspace.key('blocking', 'list')], 0.5),
          null,
        );
        assert.ok(Date.now() - startedAt >= 450);

        await client.xadd(stream, '1-0', { field: 'value' });

        startedAt = Date.now();

        assert.strictEqual(
          await client.xread([stream], ['$'], undefined, 500),
          null,
        );
        assert.ok(Date.now() - startedAt >= 450);

        startedAt = Date.now();

        assert.strictEqual(await client.wait(1, 400), 0);
        assert.ok(Date.now() - startedAt >= 350);
      } finally {
        await closeClient(client);
      }
    });

    it('extends the deadline of every blocking command by its own timeout', async () => {
      const capabilities = await detectServerCapabilities(killer);
      const stream = keyspace.key('blocking-all', 'stream');
      const list = (name: string) => keyspace.key('blocking-all', name);
      const calls: [string, (client: FeaturedClient) => Promise<unknown>][] = [
        ['brpop', (client) => client.brpop([list('brpop')], 0.5)],
        [
          'blmove',
          (client) =>
            client.blmove(list('blmove'), list('moved'), 'LEFT', 'RIGHT', 0.5),
        ],
        [
          'brpoplpush',
          (client) => client.brpoplpush(list('brpoplpush'), list('moved'), 0.5),
        ],
        ['bzpopmin', (client) => client.bzpopmin([list('bzpopmin')], 0.5)],
        ['bzpopmax', (client) => client.bzpopmax([list('bzpopmax')], 0.5)],
        [
          'xreadgroup',
          (client) =>
            client.xreadgroup('group', 'consumer', [stream], ['>'], 1, 500),
        ],
      ];

      if (capabilities.atLeast(7, 0)) {
        calls.push(
          ['blmpop', (client) => client.blmpop(0.5, [list('blmpop')], 'LEFT')],
          ['bzmpop', (client) => client.bzmpop(0.5, [list('bzmpop')], 'MIN')],
        );
      }

      if (capabilities.atLeast(7, 2)) {
        calls.push(['waitaof', (client) => client.waitaof(0, 1, 500)]);
      }

      await killer.send([
        ['XGROUP', 'CREATE', stream, 'group', '$', 'MKSTREAM'],
      ]);

      const results = await Promise.all(
        calls.map(async ([name, call]) => {
          const client = await createClient({ commandTimeout: 200 });
          const startedAt = Date.now();

          try {
            await call(client);

            return { name, elapsed: Date.now() - startedAt };
          } finally {
            await closeClient(client);
          }
        }),
      );

      for (const { name, elapsed } of results) {
        assert.ok(elapsed >= 450, `${name} returned after ${elapsed} ms`);
      }
    });

    it('never times out BLPOP 0 and serves the value when it arrives', async () => {
      const client = await createClient({ commandTimeout: 100 });
      const key = keyspace.key('blocking', 'forever');

      try {
        const popped = client.blpop([key], 0);

        await delay(400);
        await killer.rpush(key, 'late');

        assert.deepStrictEqual(await popped, [key, 'late']);
      } finally {
        await closeClient(client);
      }
    });
  });
});

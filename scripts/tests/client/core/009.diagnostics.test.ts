/** Debug logs, tolerated handshake failures and transport edges that a healthy server never produces. */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import net from 'node:net';
import { describe, it } from 'node:test';

import {
  formatDebugLog,
  SolidisClient,
  SolidisClientError,
  SolidisConnection,
  SolidisConnectionError,
  SolidisDefaultOptions,
} from '../../../../sources/index.ts';
import { MockRedisServer, mockClientOptions } from '../../utils/index.ts';

import type { SolidisDebugLog } from '../../../../sources/index.ts';

function collectDebugMessages(client: SolidisClient) {
  const messages: string[] = [];

  client.on('debug', (entry: SolidisDebugLog) => {
    messages.push(entry.message);
  });

  return messages;
}

async function startServer(reply: (command: string) => string) {
  const server = new MockRedisServer();

  server.onData((socket, data) => {
    socket.write(reply(data.toString('latin1')));
  });

  await server.listen();

  return server;
}

describe('diagnostics', () => {
  it('describes plain, authenticated and TLS endpoints without the password', () => {
    const clients = [
      new SolidisClient({ host: 'cache', port: 6380, lazyConnect: true }),
      new SolidisClient({
        host: 'cache',
        port: 6380,
        tls: {},
        authentication: { username: 'user', password: 'secret' },
        lazyConnect: true,
      }),
    ];

    assert.deepStrictEqual(
      clients.map((client) => client.uri),
      ['redis://cache:6380', 'rediss://user:***@cache:6380'],
    );

    for (const client of clients) {
      client.quit();
    }
  });

  it('logs socket errors and emitted errors when debug is enabled', async () => {
    const client = new SolidisClient({
      host: '127.0.0.1',
      port: 1,
      lazyConnect: true,
      maxConnectionRetries: 0,
      debug: true,
    });
    const messages = collectDebugMessages(client);

    client.on('error', () => {});

    try {
      await assert.rejects(client.connect(), SolidisConnectionError);

      assert.ok(messages.includes('Socket error'));
      assert.ok(messages.includes('Encountered an error'));
    } finally {
      client.quit();
    }
  });

  it('tolerates an unknown HELLO and CLIENT SETNAME and logs both', async () => {
    const server = await startServer((command) => {
      if (command.includes('HELLO')) {
        return "-ERR unknown command 'HELLO'\r\n";
      }

      if (command.includes('SETNAME')) {
        return "-ERR unknown command 'CLIENT'\r\n";
      }

      return '+PONG\r\n';
    });
    const client = new SolidisClient(
      mockClientOptions(server.port, {
        protocol: 'RESP3',
        clientName: 'probe',
        debug: true,
      }),
    );
    const messages = collectDebugMessages(client);

    client.on('error', () => {});

    try {
      await client.connect();

      assert.deepStrictEqual(await client.send([['PING']]), [['PONG']]);
      assert.ok(messages.includes('Protocol negotiation failed'));
      assert.ok(messages.includes('CLIENT SETNAME failed'));
    } finally {
      client.quit();
      await server.close();
    }
  });

  it('logs a failed initialization and the reset that follows it', async () => {
    const server = await startServer(
      () => '-WRONGPASS invalid username-password pair\r\n',
    );
    const client = new SolidisClient(
      mockClientOptions(server.port, {
        authentication: { password: 'wrong' },
        debug: true,
      }),
    );
    const messages = collectDebugMessages(client);

    client.on('error', () => {});

    try {
      await assert.rejects(client.connect(), (error: unknown) => {
        assert.ok(error instanceof SolidisClientError);
        assert.strictEqual(error.message, 'Authentication failed');

        return true;
      });

      assert.ok(messages.includes('Initialization failed'));
      assert.ok(messages.includes('Connection reset'));
    } finally {
      client.quit();
      await server.close();
    }
  });

  it('logs a connection that the server closes', async () => {
    const server = await startServer(() => '+PONG\r\n');
    const client = new SolidisClient(
      mockClientOptions(server.port, { debug: true }),
    );
    const messages = collectDebugMessages(client);

    client.on('error', () => {});

    try {
      await client.connect();

      const closed = new Promise<void>((resolve) => {
        client.once('close', () => resolve());
      });

      server.destroySockets();
      await closed;

      assert.ok(messages.includes('Connection closed'));
    } finally {
      client.quit();
      await server.close();
    }
  });

  it('keeps arguments and credentials out of every debug entry, data included', async () => {
    const secrets = ['Secret-pass-xyz', 'Runtime-pass-xyz', 'value-xyz'];
    const server = await startServer((command) =>
      command.includes('HELLO')
        ? '%1\r\n+proto\r\n:3\r\n'
        : command.includes('Runtime-pass-xyz')
          ? "-ERR invalid password 'Runtime-pass-xyz'\r\n"
          : '+OK\r\n',
    );

    try {
      for (const protocol of ['RESP2', 'RESP3'] as const) {
        const client = new SolidisClient(
          mockClientOptions(server.port, {
            protocol,
            debug: true,
            autoReconnect: true,
            maxConnectionRetries: 3,
            authentication: { username: 'user', password: 'Secret-pass-xyz' },
          }),
        );
        const lines: string[] = [];

        client.on('debug', (entry: SolidisDebugLog) => {
          lines.push(formatDebugLog(entry));
        });
        client.on('error', () => {});

        await client.connect();
        await client.send([['SET', 'key', 'value-xyz']]);
        await client.auth('user', 'Runtime-pass-xyz').catch(() => undefined);

        const ready = new Promise<void>((resolve) =>
          client.once('ready', resolve),
        );

        server.destroySockets();
        await ready;
        client.quit();
        await new Promise((resolve) => setImmediate(resolve));

        assert.ok(lines.length >= 8, `${protocol}: ${lines.length} entries`);

        for (const line of lines) {
          for (const secret of secrets) {
            assert.ok(!line.includes(secret), `${protocol}: ${line}`);
          }
        }
      }
    } finally {
      await server.close();
    }
  });

  it('logs the established connection and the completed handshake', async () => {
    const server = await startServer(() => '+OK\r\n');
    const client = new SolidisClient(
      mockClientOptions(server.port, { debug: true }),
    );
    const messages = collectDebugMessages(client);

    try {
      await client.connect();

      assert.ok(messages.includes('Connection established'));
      assert.ok(messages.includes('Initialization completed'));
    } finally {
      client.quit();
      await server.close();
    }
  });

  it('refuses a write while the socket is still connecting', async () => {
    const server = await startServer(() => '+OK\r\n');
    const connection = new SolidisConnection({
      ...SolidisDefaultOptions,
      port: server.port,
    });

    try {
      const connecting = connection.connect();

      assert.throws(() => connection.write(Buffer.from('PING\r\n')), {
        name: 'SolidisConnectionError',
        message: 'Socket is not connected.',
      });

      await connecting;

      assert.strictEqual(connection.write(Buffer.from('PING\r\n')), true);
    } finally {
      connection.quit();
      await server.close();
    }
  });

  it('stops the attempt timer when the socket closes before it connects', async (context) => {
    context.mock.method(net, 'connect', () => {
      const socket = Object.assign(new EventEmitter(), {
        destroy() {},
        setNoDelay() {},
        setKeepAlive() {},
      });

      setImmediate(() => socket.emit('close'));

      return socket as unknown as net.Socket;
    });

    const countTimers = () =>
      process
        .getActiveResourcesInfo()
        .filter((resource) => resource === 'Timeout').length;
    const timers = countTimers();
    const connection = new SolidisConnection({
      ...SolidisDefaultOptions,
      port: 1,
      connectionTimeout: 60_000,
      maxConnectionRetries: 0,
    });

    connection.on('error', () => {});

    await assert.rejects(connection.connect(), SolidisConnectionError);

    assert.strictEqual(countTimers(), timers);

    connection.quit();
  });

  it('reports a socket that closes before it connects', async (context) => {
    context.mock.method(net, 'connect', () => {
      const socket = Object.assign(new EventEmitter(), {
        destroy() {},
        setNoDelay() {},
        setKeepAlive() {},
      });

      setImmediate(() => socket.emit('close'));

      return socket as unknown as net.Socket;
    });

    const connection = new SolidisConnection({
      ...SolidisDefaultOptions,
      port: 1,
      maxConnectionRetries: 0,
    });
    const errors: unknown[] = [];

    connection.on('error', (error) => {
      errors.push(error);
    });

    await assert.rejects(connection.connect(), (error: unknown) => {
      assert.ok(error instanceof SolidisConnectionError);
      assert.strictEqual(error.message, 'Connection failed after 0 retries.');
      assert.ok(error.cause instanceof SolidisConnectionError);
      assert.strictEqual(
        error.cause.message,
        'Socket closed before connection.',
      );

      return true;
    });

    assert.strictEqual(errors.length, 1);

    connection.quit();
  });
});

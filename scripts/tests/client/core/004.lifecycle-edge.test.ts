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
  MockRedisServer,
  mockClientOptions,
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
      (error: Error) => {
        if (
          !(
            error instanceof SolidisClientError ||
            error instanceof SolidisConnectionError
          )
        ) {
          return false;
        }

        const messages = [error.message];
        const original = error.getOriginalError();

        if (original instanceof Error) {
          messages.push(original.message);
        }

        const combined = messages.join(' ');

        return (
          /tls|ssl|handshake|wrong version/i.test(combined) ||
          /ECONNRESET|closed/i.test(combined) ||
          /connection timeout/i.test(combined)
        );
      },
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

    const clientId = await client.clientId();
    const killer = track(await createClient());

    let backgroundReconnectCount = 0;

    client.on('ready', () => {
      backgroundReconnectCount += 1;
    });

    await killer.clientKill(clientId);

    await new Promise<void>((resolve) => setTimeout(resolve, 1500));

    assert.strictEqual(
      backgroundReconnectCount,
      0,
      'autoReconnect: false must suppress background reconnection after kill',
    );

    assert.strictEqual(
      await killer.clientKill(clientId),
      0,
      'client must stay disconnected without silently reconnecting',
    );
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
      const id = await waitFor(
        async (): Promise<number> => {
          try {
            const candidate = await client.clientId();
            if (candidate > 0) {
              return candidate;
            }
          } catch {}

          return 0;
        },
        { timeout: 2000, interval: 25, description: 'clientId available' },
      );

      await killer.clientKill(id);
      await killer.clientKill(id);

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

  it('emits the "reconnected" event after a successful reconnection', async () => {
    const client = track(
      await createClient({
        autoReconnect: true,
        maxConnectionRetries: 10,
        connectionRetryDelay: 25,
        connectionTimeout: 500,
      }),
    );

    let reconnectedFired = false;

    client.on('reconnected', () => {
      reconnectedFired = true;
    });

    const killer = track(await createClient());
    const clientId = await client.clientId();

    const readyPromise = new Promise<void>((resolve) => {
      client.once('ready', resolve);
    });

    await killer.clientKill(clientId);

    await readyPromise;

    assert.strictEqual(
      reconnectedFired,
      true,
      'reconnected event must fire after kill recovery',
    );
  });

  it('does not expose credentials in the uri getter', () => {
    const client = track(
      new SolidisFeaturedClient(
        buildClientOptions({
          authentication: { username: 'admin', password: 's3cret-token' },
          lazyConnect: true,
        }),
      ),
    );

    assert.ok(
      !client.uri.includes('s3cret-token'),
      'uri must not contain plaintext password',
    );
  });

  it('rejects connect() after the client has been quit', async () => {
    const client = new SolidisFeaturedClient(
      buildClientOptions({ lazyConnect: true }),
    );

    client.on('error', () => {});
    client.quit();

    await assert.rejects(
      () => client.connect(),
      (error: Error) =>
        error instanceof SolidisClientError && /closed/i.test(error.message),
    );
  });

  it('returns immediately when connect() is called on an already-connected client', async () => {
    const client = track(await createClient());

    const idBefore = await client.clientId();

    await client.connect();

    const idAfter = await client.clientId();

    assert.strictEqual(
      idBefore,
      idAfter,
      'the server-assigned client ID must not change, proving no ' +
        'reconnection occurred and the early-return path was taken',
    );
  });

  it('does not background-reconnect after quit closes the transport socket', async () => {
    const client = track(
      await createClient({
        autoReconnect: true,
        maxConnectionRetries: 5,
        connectionRetryDelay: 50,
      }),
    );

    let readyAfterQuit = false;

    client.on('ready', () => {
      readyAfterQuit = true;
    });

    await client.ping();

    const ended = new Promise<void>((resolve) => client.once('end', resolve));

    client.quit();

    await ended;

    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.strictEqual(
      readyAfterQuit,
      false,
      'quit must set isQuitted so the socket close handler skips reconnect',
    );
  });

  it('emits an error when non-lazy connect targets an unreachable port', async () => {
    const errorPromise = new Promise<Error>((resolve) => {
      const client = new SolidisFeaturedClient(
        buildClientOptions({
          host: '127.0.0.1',
          port: 1,
          lazyConnect: false,
          maxConnectionRetries: 0,
          connectionTimeout: 200,
        }),
      );

      client.on('error', (error) => {
        resolve(error);
        client.quit();
      });
    });

    const error = await errorPromise;

    assert.ok(
      error instanceof SolidisClientError ||
        error instanceof SolidisConnectionError,
    );
  });

  it('skips standalone AUTH when HELLO carries credentials (RESP3 single-HELLO auth)', async () => {
    const server = new MockRedisServer();
    await server.listen();

    let helloReceived = false;
    let authReceived = false;

    server.onData((socket, data) => {
      const text = data.toString();

      if (text.includes('HELLO')) {
        helloReceived = true;

        socket.write(
          Buffer.from(
            '%7\r\n' +
              '$6\r\nserver\r\n$5\r\nredis\r\n' +
              '$7\r\nversion\r\n$5\r\n7.0.0\r\n' +
              '$5\r\nproto\r\n:3\r\n' +
              '$2\r\nid\r\n:1\r\n' +
              '$4\r\nmode\r\n$10\r\nstandalone\r\n' +
              '$4\r\nrole\r\n$6\r\nmaster\r\n' +
              '$7\r\nmodules\r\n*0\r\n',
            'latin1',
          ),
        );

        return;
      }

      if (text.includes('AUTH')) {
        authReceived = true;
      }

      socket.write(Buffer.from('+OK\r\n', 'latin1'));
    });

    const client = new SolidisFeaturedClient(
      mockClientOptions(server.port, {
        protocol: 'RESP3',
        authentication: { username: 'testuser', password: 'testpass' },
        enableReadyCheck: false,
      }),
    );

    track(client);
    client.on('error', () => {});

    await client.connect();

    assert.ok(helloReceived, 'HELLO must have been sent with credentials');

    assert.strictEqual(
      authReceived,
      false,
      '#hello() must return true when username and password are both ' +
        'provided, causing #onConnect to skip the separate #authenticate() ' +
        'call — AUTH should never be sent when HELLO already carried credentials',
    );

    client.quit();
    await server.close();
  });
});

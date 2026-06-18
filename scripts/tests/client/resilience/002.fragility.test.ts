/** Fragility & recovery: hostile payloads, protocol corruption, and fault accounting. */

import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../../sources/client/featured.ts';
import {
  RespError,
  SolidisClientError,
  SolidisCommandError,
  SolidisParserError,
} from '../../../../sources/index.ts';
import {
  closeClient,
  createClient,
  createKeyspace,
  delay,
  MockRedisServer,
  mockClientOptions,
  randomBuffer,
  range,
  waitFor,
} from '../../utils/index.ts';

import type { FeaturedClient } from '../../utils/index.ts';

describe('fragility', () => {
  const keyspace = createKeyspace('fragility');

  const mockClients: FeaturedClient[] = [];
  const mockServers: MockRedisServer[] = [];

  const trackMockClient = (client: FeaturedClient): FeaturedClient => {
    client.on('error', () => {});
    mockClients.push(client);

    return client;
  };

  const startMockServer = async (): Promise<MockRedisServer> => {
    const server = new MockRedisServer();
    mockServers.push(server);
    await server.listen();

    return server;
  };

  afterEach(async () => {
    for (const client of mockClients.splice(0)) {
      client.quit();
    }

    for (const server of mockServers.splice(0)) {
      await server.close();
    }
  });

  describe('hostile payloads keep the client healthy', () => {
    let client: FeaturedClient;

    before(async () => {
      client = await createClient({ commandTimeout: 300 });
    });

    after(async () => {
      await closeClient(client);
    });

    const assertStillHealthy = async (probe: string) => {
      const key = keyspace.key('healthy', probe);

      assert.strictEqual(await client.set(key, probe), 'OK');
      assert.strictEqual(await client.get(key), probe);
    };

    it('recovers from an empty command frame via timeout', async () => {
      await assert.rejects(
        () => client.send([[]]),
        (error: Error) => /timed out/i.test(error.message),
      );

      await assertStillHealthy('empty-frame');
    });

    it('round-trips binary values containing NUL and CRLF bytes', async () => {
      const key = keyspace.key('binary');
      const payload = Buffer.from([0, 13, 10, 255, 0, 42, 13, 10, 7]);

      assert.strictEqual(await client.set(key, payload), 'OK');

      const echoed = await client.getBuffer(key);

      assert.ok(Buffer.isBuffer(echoed));
      assert.ok(echoed.equals(payload));

      await assertStillHealthy('binary');
    });

    it('round-trips a large multi-megabyte value intact', async () => {
      const key = keyspace.key('large');
      const payload = randomBuffer(3 * 1024 * 1024);

      assert.strictEqual(await client.set(key, payload), 'OK');

      const echoed = await client.getBuffer(key);

      assert.ok(Buffer.isBuffer(echoed));
      assert.strictEqual(echoed.length, payload.length);
      assert.ok(echoed.equals(payload));

      await assertStillHealthy('large');
    });

    it('isolates a bogus binary command name as an inline error', async () => {
      const [[reply]] = await client.send([
        [Buffer.from([0x01, 0x02, 0x03]), 'arg'],
      ]);

      assert.ok(reply instanceof RespError);

      await assertStillHealthy('bogus-name');
    });

    it('isolates a wrong-arity command as an inline error', async () => {
      const [[reply]] = await client.send([['GET']]);

      assert.ok(reply instanceof RespError);
      assert.match(`${reply.message}`, /wrong number of arguments/i);

      await assertStillHealthy('wrong-arity');
    });

    it('keeps surrounding commands correct when one errors mid-pipeline', async () => {
      const key = keyspace.key('mixed-pipeline');

      const replies = await client.send([
        ['SET', key, 'value'],
        ['INCR', key],
        ['LPUSH', key, 'x'],
        ['GET', key],
        ['NOTACOMMAND'],
        ['APPEND', key, '!'],
      ]);

      assert.strictEqual(replies[0][0], 'OK');
      assert.ok(replies[1][0] instanceof RespError);
      assert.ok(replies[2][0] instanceof RespError);
      assert.strictEqual(`${replies[3][0]}`, 'value');
      assert.ok(replies[4][0] instanceof RespError);
      assert.strictEqual(replies[5][0], 6);

      assert.strictEqual(await client.get(key), 'value!');

      await assertStillHealthy('mixed-pipeline');
    });

    it('absorbs a chaotic burst of mixed valid and invalid commands', async () => {
      const key = keyspace.key('chaos');

      const commands = range(200).map((index) => {
        switch (index % 5) {
          case 0:
            return ['SET', key, `${index}`];
          case 1:
            return ['INCR', key];
          case 2:
            return ['NOTACOMMAND', `${index}`];
          case 3:
            return [Buffer.from([index & 0xff]), 'x'];
          default:
            return ['GET', key];
        }
      });

      const replies = await client.send(commands);

      assert.strictEqual(replies.length, commands.length);
      assert.ok(replies.every((reply) => reply.length === 1));

      await assertStillHealthy('chaos');
    });
  });

  describe('protocol corruption from the server', () => {
    it('emits a parser error on an unknown RESP type prefix', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('@definitely-not-resp\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      const parserErrors: SolidisParserError[] = [];

      client.on('error', (error) => {
        if (error instanceof SolidisParserError) {
          parserErrors.push(error);
        }
      });

      await client.connect();

      await assert.rejects(
        () => client.ping(),
        (error: Error) => error instanceof SolidisParserError,
      );

      await waitFor(() => parserErrors.length > 0, {
        timeout: 500,
        description: 'parser error surfaced',
      });

      assert.ok(parserErrors[0] instanceof SolidisParserError);
    });

    it('discards unsolicited replies without desynchronising correlation', async () => {
      const server = await startMockServer();

      let commandIndex = 0;

      server.onData((socket) => {
        commandIndex += 1;

        if (commandIndex === 1) {
          socket.write(Buffer.from('+FIRST\r\n+UNSOLICITED\r\n', 'latin1'));
          return;
        }

        socket.write(Buffer.from('+SECOND\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      const first = await client.send([['PING']]);
      const second = await client.send([['PING']]);

      assert.deepStrictEqual(first, [['FIRST']]);
      assert.deepStrictEqual(second, [['SECOND']]);
    });

    it('reassembles a reply delivered one byte at a time', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        const frame = Buffer.from('+PONG\r\n', 'latin1');
        let cursor = 0;

        const timer = setInterval(() => {
          if (cursor >= frame.length) {
            clearInterval(timer);
            return;
          }

          socket.write(frame.subarray(cursor, cursor + 1));
          cursor += 1;
        }, 2);
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      assert.deepStrictEqual(await client.send([['PING']]), [['PONG']]);
    });

    it('rejects the in-flight command when the server vanishes mid-reply', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('$100\r\npartial', 'latin1'));
        setTimeout(() => socket.destroy(), 10);
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(() => client.get(keyspace.key('vanish')));
    });

    it('triggers fault recovery for inflight commands on a corrupt frame', async () => {
      const server = await startMockServer();

      let commandIndex = 0;

      server.onData((socket) => {
        commandIndex += 1;

        if (commandIndex === 1) {
          socket.write('+OK\r\n');

          return;
        }

        socket.write(Buffer.from([0x01, 0x0d, 0x0a]));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            commandTimeout: 5000,
            autoReconnect: false,
          }),
        ),
      );

      await client.connect();
      await client.send([['PING']]);

      const startTime = Date.now();

      await assert.rejects(
        client.send([['PING']]),
        (error: Error) =>
          error.message.toLowerCase().includes('parser') ||
          error.message.toLowerCase().includes('prefix'),
      );

      const elapsed = Date.now() - startTime;

      assert.ok(
        elapsed < 2000,
        `expected immediate rejection but took ${elapsed}ms`,
      );
    });
  });

  describe('fault recovery and data-loss accounting', () => {
    it('rejects in-flight work and recovers after a forced disconnect', async () => {
      const client = await createClient({
        autoReconnect: true,
        maxConnectionRetries: 5,
        connectionRetryDelay: 25,
        connectionTimeout: 500,
      });

      client.on('error', () => {});

      const blockKey = keyspace.key('recover-block');
      const liveKey = keyspace.key('recover-live');

      await client.set(liveKey, 'before');

      const clientId = await client.clientId();
      const killer = await createClient();

      const blocked = client
        .blpop([blockKey], 0)
        .then(() => false)
        .catch(() => true);

      await delay(30);
      await killer.clientKill(clientId);

      assert.strictEqual(await blocked, true);

      await waitFor(
        async () => {
          try {
            return (await client.ping()) === 'PONG';
          } catch {
            return false;
          }
        },
        { timeout: 2000, interval: 30, description: 'auto-reconnect' },
      );

      assert.strictEqual(await client.get(liveKey), 'before');
      assert.strictEqual(await client.set(liveKey, 'after'), 'OK');
      assert.strictEqual(await client.get(liveKey), 'after');

      await closeClient(killer);
      await closeClient(client);
    });

    it('accounts for every queued write across a disconnect boundary', async () => {
      const client = await createClient({
        autoReconnect: true,
        maxConnectionRetries: 5,
        connectionRetryDelay: 25,
        connectionTimeout: 500,
      });

      client.on('error', () => {});

      const total = 500;
      const clientId = await client.clientId();
      const killer = await createClient();

      const outcomes = range(total).map((index) =>
        client
          .set(keyspace.key('loss', index), `${index}`)
          .then(() => 'resolved' as const)
          .catch(() => 'rejected' as const),
      );

      await killer.clientKill(clientId);

      const settled = await Promise.all(outcomes);
      const resolved = settled.filter((value) => value === 'resolved').length;
      const rejected = settled.filter((value) => value === 'rejected').length;

      assert.strictEqual(resolved + rejected, total);

      await waitFor(
        async () => {
          try {
            return (await client.ping()) === 'PONG';
          } catch {
            return false;
          }
        },
        { timeout: 2000, interval: 50, description: 'auto-reconnect' },
      );

      let persisted = 0;
      const batchSize = 100;

      for (let index = 0; index < total; index += batchSize) {
        const keys = range(Math.min(batchSize, total - index)).map((j) =>
          keyspace.key('loss', index + j),
        );
        const values = await client.mget(...keys);

        for (let j = 0; j < values.length; j += 1) {
          if (values[j] === `${index + j}`) {
            persisted += 1;
          }
        }
      }

      assert.ok(
        persisted >= resolved,
        `persisted (${persisted}) must cover resolved (${resolved})`,
      );
      assert.ok(persisted <= total);

      assert.strictEqual(
        await client.set(keyspace.key('loss-final'), 'ok'),
        'OK',
      );

      await closeClient(killer);
      await closeClient(client);
    });

    it('does not misinterpret replies as pubsub events after recovery with disabled auto-recovery', async () => {
      const server = await startMockServer();

      let phase = 'initial';

      server.onData((socket, data) => {
        const text = data.toString();

        if (phase === 'initial' && text.includes('SUBSCRIBE')) {
          socket.write('*3\r\n$9\r\nsubscribe\r\n$9\r\nchannel-a\r\n:1\r\n');

          return;
        }

        if (phase === 'reconnected') {
          socket.write(
            '*3\r\n$7\r\nmessage\r\n$9\r\nchannel-a\r\n$5\r\nhello\r\n',
          );

          return;
        }
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            autoReconnect: true,
            autoRecovery: {
              database: false,
              subscribe: false,
              ssubscribe: false,
              psubscribe: false,
            },
            commandTimeout: 1000,
            maxConnectionRetries: 3,
            connectionRetryDelay: 50,
            connectionTimeout: 1000,
          }),
        ),
      );

      await client.connect();
      await client.subscribe('channel-a');

      const reconnectedReady = new Promise<void>((resolve) => {
        client.once('ready', resolve);
      });

      phase = 'reconnected';
      server.destroySockets();

      await reconnectedReady;

      const result = await client.send([['GET', 'test-key']]);

      assert.ok(
        Array.isArray(result) && result.length === 1,
        'command reply must not be consumed as a pubsub event',
      );
    });
  });

  describe('permanently broken clients reject deterministically', () => {
    it('rejects every command after quit', async () => {
      const client = await createClient();

      await client.set(keyspace.key('quit'), 'value');

      client.quit();

      await assert.rejects(
        () => client.get(keyspace.key('quit')),
        (error: Error) =>
          error instanceof SolidisClientError &&
          /not connected|closed/i.test(error.message),
      );

      await assert.rejects(() => client.ping());
    });

    it('rejects when connecting to a port with no listener', async () => {
      const server = await startMockServer();
      const deadPort = server.port;

      await server.close();

      const client = new SolidisFeaturedClient(
        mockClientOptions(deadPort, { lazyConnect: true }),
      );

      client.on('error', () => {});

      await assert.rejects(
        () => client.connect(),
        (error: Error) => error instanceof SolidisClientError,
      );

      client.quit();
    });
  });

  describe('reply chain resilience', () => {
    it('does not stall reply processing when a listener throws during pubsub dispatch', async () => {
      const server = await startMockServer();
      let requestCount = 0;

      server.onData((socket) => {
        requestCount += 1;

        if (requestCount === 1) {
          socket.write(
            Buffer.from(
              '*3\r\n$9\r\nsubscribe\r\n$2\r\nch\r\n:1\r\n' +
                '*3\r\n$7\r\nmessage\r\n$2\r\nch\r\n$4\r\nboom\r\n',
              'latin1',
            ),
          );
        } else if (requestCount === 2) {
          socket.write(Buffer.from('$5\r\nhello\r\n', 'latin1'));
        }
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, { commandTimeout: 500 }),
        ),
      );

      await client.connect();

      const stash: unknown[] = [];
      const trap = (reason: unknown) => stash.push(reason);

      process.on('unhandledRejection', trap);

      client.on('message', () => {
        throw new Error('listener crash');
      });

      await client.send([['SUBSCRIBE', 'ch']]);

      await delay(50);

      const reply = await client.send([['GET', 'key']]);

      process.off('unhandledRejection', trap);

      assert.strictEqual(`${reply[0][0]}`, 'hello');
    });
  });

  describe('ready check', () => {
    it('does not emit ready when the ready check encounters an error', async () => {
      const server = await startMockServer();

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            enableReadyCheck: true,
            commandTimeout: 300,
          }),
        ),
      );

      let readyFired = false;

      client.on('ready', () => {
        readyFired = true;
      });

      try {
        await client.connect();
      } catch {}

      assert.strictEqual(
        readyFired,
        false,
        'ready must not fire when the ready check fails',
      );
    });
  });

  describe('error construction', () => {
    it('does not pass command arrays as originalError in acl.log error path', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+not-an-array\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      let caught: unknown;

      try {
        await client.aclLog();
      } catch (error) {
        caught = error;
      }

      assert.ok(caught instanceof SolidisCommandError);

      const original = caught.getOriginalError();

      assert.ok(
        original === undefined || original instanceof Error,
        `originalError must be undefined or Error, got ${typeof original}`,
      );
    });
  });

  describe('orphan reply detection', () => {
    it('emits an error when receiving a reply with no pending request', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+OK\r\n+ORPHAN\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      const errors: Error[] = [];

      client.on('error', (error) => errors.push(error));

      await client.send([['PING']]);

      await delay(100);

      assert.ok(
        errors.length > 0,
        'orphan reply must trigger an error or warning event',
      );
    });
  });
});

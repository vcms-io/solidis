/** Fragility & recovery: hostile payloads, protocol corruption, and fault accounting. */

import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../../sources/client/featured.ts';
import {
  RespError,
  SolidisClientError,
  SolidisCommandError,
  SolidisParserError,
  SolidisRequesterError,
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

const buildLargeEchoCommands = (count: number, payloadSize: number) =>
  Array.from({ length: count }, () => ['ECHO', 'x'.repeat(payloadSize)]);

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
        (error: Error) =>
          error instanceof SolidisRequesterError &&
          error.message === 'Solidis command(s) timed out after 300 ms.',
      );

      await assertStillHealthy('empty-frame');
    });

    it('round-trips binary values containing NUL and CRLF bytes', async () => {
      const key = keyspace.key('binary');
      const payload = Buffer.from([0, 13, 10, 255, 0, 42, 13, 10, 7]);

      assert.strictEqual(await client.set(key, payload), 'OK');

      const echoed = await client.getBuffer(key);

      assert.deepStrictEqual(echoed, payload);

      await assertStillHealthy('binary');
    });

    it('round-trips a large multi-megabyte value intact', async () => {
      const key = keyspace.key('large');
      const payload = randomBuffer(3 * 1024 * 1024);

      assert.strictEqual(await client.set(key, payload), 'OK');

      const echoed = await client.getBuffer(key);

      assert.deepStrictEqual(echoed, payload);

      await assertStillHealthy('large');
    });

    it('isolates a bogus binary command name as an inline error', async () => {
      const [[reply]] = await client.send([
        [Buffer.from([0x01, 0x02, 0x03]), 'arg'],
      ]);

      assert.ok(reply instanceof RespError);
      assert.strictEqual(
        reply.message,
        "ERR unknown command '\x01\x02\x03', with args beginning with: 'arg' ",
      );

      await assertStillHealthy('bogus-name');
    });

    it('isolates a wrong-arity command as an inline error', async () => {
      const [[reply]] = await client.send([['GET']]);

      assert.ok(reply instanceof RespError);
      assert.strictEqual(
        reply.message,
        "ERR wrong number of arguments for 'get' command",
      );

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
      assert.strictEqual(
        replies[1][0].message,
        'ERR value is not an integer or out of range',
      );
      assert.ok(replies[2][0] instanceof RespError);
      assert.strictEqual(
        replies[2][0].message,
        'WRONGTYPE Operation against a key holding the wrong kind of value',
      );
      assert.strictEqual(`${replies[3][0]}`, 'value');
      assert.ok(replies[4][0] instanceof RespError);
      assert.strictEqual(
        replies[4][0].message,
        "ERR unknown command 'NOTACOMMAND', with args beginning with: ",
      );
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

      for (let index = 0; index < replies.length; index += 1) {
        const reply = replies[index][0];

        switch (index % 5) {
          case 0:
            assert.strictEqual(reply, 'OK');
            break;
          case 1:
            assert.strictEqual(reply, index);
            break;
          case 2:
            assert.ok(reply instanceof RespError);
            assert.strictEqual(
              reply.message,
              `ERR unknown command 'NOTACOMMAND', with args beginning with: '${index}' `,
            );
            break;
          case 3: {
            assert.ok(reply instanceof RespError);
            assert.strictEqual(
              reply.message.slice(0, 'ERR unknown command '.length),
              'ERR unknown command ',
            );
            assert.strictEqual(
              reply.message.slice(-", with args beginning with: 'x' ".length),
              ", with args beginning with: 'x' ",
            );
            break;
          }
          default:
            assert.strictEqual(`${reply}`, `${index - 3}`);
        }
      }

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
        (error: Error) =>
          error instanceof SolidisParserError &&
          error.message === "Unknown prefix '@' in Solidis response",
      );

      await waitFor(() => parserErrors.length > 0, {
        timeout: 500,
        description: 'parser error surfaced',
      });

      assert.strictEqual(
        parserErrors[0].message,
        "Unknown prefix '@' in Solidis response",
      );
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

    it('grows the parser buffer when a bulk reply exceeds the initial capacity', async () => {
      const server = await startMockServer();
      const payloadSize = 200_000;
      const payload = 'z'.repeat(payloadSize);
      const header = `$${payloadSize}\r\n`;
      const bodyPart1 = payload.slice(0, 150_000);
      const bodyPart2 = `${payload.slice(150_000)}\r\n`;

      server.onData((socket) => {
        socket.write(Buffer.from(header, 'latin1'));
        socket.write(Buffer.from(bodyPart1, 'latin1'));
        socket.write(Buffer.from(bodyPart2, 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            parser: {
              buffer: { initial: 65536, shiftThreshold: 32768 },
              maxBulkStringLength: 1048576,
            },
          }),
        ),
      );

      await client.connect();

      const [[reply]] = await client.send([['GET', 'large-key']]);

      assert.deepStrictEqual(reply, Buffer.from(payload, 'latin1'));
    });

    it('shifts the parser buffer after many small replies accumulate readOffset', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+O', 'latin1'));
        socket.write(Buffer.from(`K\r\n${'+OK\r\n'.repeat(19)}`, 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            parser: {
              buffer: { initial: 512, shiftThreshold: 16 },
              maxBulkStringLength: 1048576,
            },
          }),
        ),
      );

      await client.connect();

      const replies = await client.send(range(20).map(() => ['PING'] as const));

      assert.deepStrictEqual(
        replies,
        Array.from({ length: 20 }, () => ['OK']),
      );
    });

    it('reassembles a RESP3 null reply split across two socket chunks', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('_\r', 'latin1'));
        socket.write(Buffer.from('\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, { protocol: 'RESP3' }),
        ),
      );

      await client.connect();

      const [[reply]] = await client.send([['GET', 'missing-key']]);

      assert.strictEqual(reply, null);
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

      await assert.rejects(
        () => client.get(keyspace.key('vanish')),
        (error: Error) =>
          error instanceof SolidisClientError &&
          error.message ===
            'SolidisConnectionError: Solidis connection closed.',
      );
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
          error instanceof SolidisParserError &&
          error.message === "Unknown prefix '\x01' in Solidis response",
      );

      const elapsed = Date.now() - startTime;

      assert.ok(elapsed >= 0);
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
        .then(() => ({ rejected: false as const, error: undefined }))
        .catch((error: unknown) => ({ rejected: true as const, error }));

      await waitFor(
        async () => {
          const list = await killer.clientList();
          return list.includes('cmd=blpop');
        },
        {
          timeout: 2000,
          interval: 10,
          description: 'blpop registered on server',
        },
      );
      await killer.clientKill(clientId);

      const blockOutcome = await blocked;

      assert.strictEqual(blockOutcome.rejected, true);

      if (!(blockOutcome.error instanceof SolidisClientError)) {
        assert.fail('forced disconnect must reject with SolidisClientError');
      }

      assert.strictEqual(
        blockOutcome.error.message,
        'SolidisConnectionError: Solidis connection closed.',
      );

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

      assert.deepStrictEqual(result, [
        [
          [
            Buffer.from('message'),
            Buffer.from('channel-a'),
            Buffer.from('hello'),
          ],
        ],
      ]);
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
          error.message === 'Not connected with redis server.',
      );

      await assert.rejects(
        () => client.ping(),
        (error: Error) =>
          error instanceof SolidisClientError &&
          error.message === 'Not connected with redis server.',
      );
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
        (error: Error) =>
          error instanceof SolidisClientError &&
          error.message.startsWith(
            'SolidisConnectionError: Error: connect ECONNREFUSED 127.0.0.1:',
          ),
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
              '*3\r\n$9\r\nsubscribe\r\n$2\r\nch\r\n:1\r\n*3\r\n$7\r\nmessage\r\n$2\r\nch\r\n$4\r\nboom\r\n',
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

      let listenerCrashed = false;

      client.on('message', () => {
        listenerCrashed = true;
        throw new Error('listener crash');
      });

      await client.send([['SUBSCRIBE', 'ch']]);

      await waitFor(() => listenerCrashed, {
        timeout: 1000,
        interval: 5,
        description: 'pubsub listener throws',
      });

      const reply = await client.send([['GET', 'key']]);

      process.off('unhandledRejection', trap);

      assert.strictEqual(`${reply[0][0]}`, 'hello');
    });
  });

  describe('ready check', () => {
    it('rejects connect when the server stays loading beyond maxReadyCheckRetries', async () => {
      const server = await startMockServer();

      server.onData((socket, data) => {
        const text = data.toString();

        if (text.includes('INFO')) {
          const infoPayload =
            'loading:1\r\nloading_start_time:1000000\r\nloading_total_bytes:100000000\r\n';

          socket.write(
            Buffer.from(
              `$${infoPayload.length}\r\n${infoPayload}\r\n`,
              'latin1',
            ),
          );

          return;
        }

        socket.write(Buffer.from('+OK\r\n', 'latin1'));
      });

      const connectDeadline = 2000;

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            enableReadyCheck: true,
            maxReadyCheckRetries: 10,
            readyCheckInterval: 50,
            commandTimeout: 30000,
            connectionTimeout: 30000,
            autoReconnect: false,
          }),
        ),
      );

      const connectOutcome = await Promise.race([
        client
          .connect()
          .then(() => 'connected' as const)
          .catch((error: Error) => ({
            status: 'rejected' as const,
            error,
          })),
        delay(connectDeadline).then(() => 'timed-out' as const),
      ]);

      assert.notStrictEqual(
        connectOutcome,
        'connected',
        'connect() must not succeed while the server keeps reporting loading:1',
      );
      assert.notStrictEqual(
        connectOutcome,
        'timed-out',
        'connect() must reject within ' +
          `${connectDeadline}ms once maxReadyCheckRetries is exhausted ` +
          'while the server keeps reporting loading:1',
      );
      assert.ok(
        typeof connectOutcome === 'object' &&
          connectOutcome !== null &&
          connectOutcome.status === 'rejected' &&
          connectOutcome.error instanceof SolidisClientError,
        'connect() must reject once maxReadyCheckRetries is exhausted ' +
          'while the server keeps reporting loading:1',
      );
      assert.strictEqual(connectOutcome.error.message, 'Ready check failed');
    });

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

      const error = await client.connect().catch((caught: Error) => caught);

      assert.ok(error instanceof SolidisClientError);
      assert.strictEqual(error.message, 'Ready check failed');

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
      assert.strictEqual(
        caught.message,
        '[ACL LOG] Unexpected reply: not-an-array',
      );

      assert.strictEqual(caught.getOriginalError(), undefined);
    });
  });

  describe('command timeout cascade', () => {
    it('does not cascade-reject a later pipeline before its own timeout expires', async () => {
      const server = await startMockServer();

      server.onData(() => {});

      const commandTimeout = 200;
      const staggerDelay = 100;

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            commandTimeout,
            autoReconnect: false,
          }),
        ),
      );

      await client.connect();

      const startTime = Date.now();

      const commandA = client.send([['COMMAND-A']]).catch((error: Error) => ({
        rejected: true as const,
        error,
        elapsed: Date.now() - startTime,
      }));

      await delay(staggerDelay);

      const commandB = client.send([['COMMAND-B']]).catch((error: Error) => ({
        rejected: true as const,
        error,
        elapsed: Date.now() - startTime,
      }));

      const [resultA, resultB] = await Promise.all([commandA, commandB]);

      assert.ok(
        typeof resultA === 'object' &&
          resultA !== null &&
          'rejected' in resultA &&
          resultA.rejected === true,
        'Command A must be rejected by its own timeout',
      );
      assert.ok(resultA.error instanceof SolidisRequesterError);
      assert.strictEqual(
        resultA.error.message,
        'Solidis command(s) timed out after 200 ms.',
      );

      assert.ok(
        typeof resultB === 'object' &&
          resultB !== null &&
          'rejected' in resultB &&
          resultB.rejected === true,
        'Command B must also be rejected',
      );
      assert.ok(resultB.error instanceof SolidisRequesterError);
      assert.strictEqual(
        resultB.error.message,
        'Solidis command(s) timed out after 200 ms.',
      );

      assert.ok(
        resultB.elapsed >= commandTimeout + staggerDelay - 30,
        'Command B was rejected at ' +
          `${resultB.elapsed}ms instead of its own timeout at ` +
          `~${commandTimeout + staggerDelay}ms — Command A's timeout ` +
          `at ~${commandTimeout}ms triggered recoveryFromFault which ` +
          'cascade-rejects ALL pending pipelines, cutting short ' +
          "Command B's legitimate timeout window",
      );
      assert.ok(
        resultB.elapsed <= commandTimeout + staggerDelay + 500,
        `Command B timeout took unexpectedly long: ${resultB.elapsed}ms`,
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

      await waitFor(() => errors.length > 0, {
        description: 'orphan reply error event',
      });

      assert.strictEqual(
        errors[0].message,
        'Received reply with no pending request',
      );
    });
  });

  describe('connection lifecycle guards', () => {
    it('throws when a quit client retries connection during #tryConnectWithRetry', async () => {
      const server = await startMockServer();
      const deadPort = server.port;

      await server.close();

      let retryAttempted = false;

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(deadPort, {
            maxConnectionRetries: 20,
            connectionRetryDelay: 10,
            connectionTimeout: 50,
          }),
        ),
      );

      client.on('error', () => {
        retryAttempted = true;
      });

      const connectPromise = client.connect().catch((error: Error) => error);

      await waitFor(() => retryAttempted, {
        description: 'connection retry to begin',
      });

      client.quit();

      const result = await connectPromise;

      assert.ok(result instanceof SolidisClientError);
      assert.ok(
        result.message.startsWith(
          'SolidisConnectionError: Error: connect ECONNREFUSED 127.0.0.1:',
        ),
        'connect() must reject when quit is called during retry',
      );
    });
  });

  describe('parser error during data processing', () => {
    it('emits a parser error and cleans up when onData encounters corrupt bytes', async () => {
      const server = await startMockServer();

      let commandIndex = 0;

      server.onData((socket) => {
        commandIndex += 1;

        if (commandIndex === 1) {
          socket.write(Buffer.from('+OK\r\n', 'latin1'));

          return;
        }

        socket.write(Buffer.from([0xff, 0xfe, 0x0d, 0x0a]));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            commandTimeout: 2000,
            autoReconnect: false,
          }),
        ),
      );

      const parserErrors: SolidisParserError[] = [];

      client.on('error', (error) => {
        if (error instanceof SolidisParserError) {
          parserErrors.push(error);
        }
      });

      await client.connect();
      await client.send([['PING']]);

      await assert.rejects(
        () => client.send([['PING']]),
        (error: Error) =>
          error instanceof SolidisParserError &&
          error.message === "Unknown prefix '\xff' in Solidis response",
      );

      await waitFor(() => parserErrors.length > 0, {
        timeout: 500,
        description: 'parser error surfaced from corrupt bytes in onData',
      });

      assert.strictEqual(
        parserErrors[0].message,
        "Unknown prefix '\xff' in Solidis response",
      );
    });
  });

  describe('HELLO protocol selection edge cases', () => {
    it('falls back gracefully when the server does not support HELLO', async () => {
      const server = await startMockServer();

      server.onData((socket, data) => {
        const text = data.toString();

        if (text.includes('HELLO')) {
          socket.write(
            Buffer.from('-ERR unknown command `HELLO`\r\n', 'latin1'),
          );

          return;
        }

        if (text.includes('INFO')) {
          socket.write(Buffer.from('$11\r\nloading:0\r\n\r\n', 'latin1'));

          return;
        }

        socket.write(Buffer.from('+OK\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            protocol: 'RESP3',
            enableReadyCheck: false,
            commandTimeout: 1000,
          }),
        ),
      );

      await client.connect();

      const result = await client.send([['PING']]);

      assert.deepStrictEqual(result, [['OK']]);
    });

    it('recovers when CLIENT SETNAME is denied by ACL', async () => {
      const server = await startMockServer();

      server.onData((socket, data) => {
        const text = data.toString();

        if (text.includes('CLIENT') && text.includes('SETNAME')) {
          socket.write(
            Buffer.from(
              '-NOPERM this user has no permissions to run CLIENT SETNAME\r\n',
              'latin1',
            ),
          );

          return;
        }

        socket.write(Buffer.from('+OK\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            clientName: 'blocked-name',
            enableReadyCheck: false,
          }),
        ),
      );

      await client.connect();

      const result = await client.send([['PING']]);

      assert.deepStrictEqual(result, [['OK']]);
    });
  });

  describe('recovery step failure', () => {
    it('absorbs a recovery step error and continues operating', async () => {
      const server = await startMockServer();

      let selectReceived = false;

      server.onData((socket, data) => {
        const text = data.toString();

        if (text.includes('SELECT')) {
          selectReceived = true;

          socket.write(Buffer.from('-ERR invalid DB index\r\n', 'latin1'));

          return;
        }

        if (text.includes('PING')) {
          socket.write(Buffer.from('+PONG\r\n', 'latin1'));

          return;
        }

        socket.write(Buffer.from('+OK\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            enableReadyCheck: false,
            database: 15,
            autoRecovery: {
              database: true,
              subscribe: false,
              ssubscribe: false,
              psubscribe: false,
            },
          }),
        ),
      );

      await client.connect();

      assert.strictEqual(
        selectReceived,
        true,
        'SELECT 15 must have been sent as a recovery step',
      );

      const result = await client.send([['PING']]);

      assert.deepStrictEqual(
        result,
        [['PONG']],
        'client must remain functional after a failed recovery step',
      );
    });
  });

  describe('recoveryFromFault idempotency', () => {
    it('does not double-reject when recoveryFromFault is called twice rapidly', async () => {
      const { SolidisRequester } = await import(
        '../../../../sources/modules/requester.ts'
      );
      const { SolidisPubSub } = await import(
        '../../../../sources/modules/pubsub.ts'
      );
      const { SolidisDefaultOptions } = await import(
        '../../../../sources/common/constants.ts'
      );

      const mockConnection = {
        socket: null,
        reset() {},
      };

      const requester = new SolidisRequester({
        ...SolidisDefaultOptions,
        connection: mockConnection as never,
        pubSub: new SolidisPubSub(),
      });

      const pending = requester
        .send([['COMMAND-A']])
        .catch((error: Error) => error);

      let rejectionCount = 0;

      pending.then((result) => {
        if (result instanceof Error) {
          rejectionCount += 1;
        }
      });

      requester.recoveryFromFault(new Error('first fault'));
      requester.recoveryFromFault(new Error('second fault'));

      const result = await pending;

      assert.ok(result instanceof Error);
      assert.strictEqual(
        result.message,
        'first fault',
        'pending command should be rejected after fault recovery',
      );
      assert.strictEqual(
        rejectionCount,
        1,
        'command must be rejected exactly once despite two recoveryFromFault calls',
      );
    });
  });

  describe('unsubscribe expansion', () => {
    it('expands an empty UNSUBSCRIBE to include all subscribed channels', async () => {
      const server = await startMockServer();

      const received: string[] = [];

      server.onData((socket, data) => {
        const text = data.toString();
        received.push(text);

        if (text.includes('SUBSCRIBE') && !text.includes('UNSUBSCRIBE')) {
          socket.write(
            Buffer.from(
              '*3\r\n$9\r\nsubscribe\r\n$2\r\nch\r\n:1\r\n',
              'latin1',
            ),
          );

          return;
        }

        if (text.includes('UNSUBSCRIBE')) {
          socket.write(
            Buffer.from(
              '*3\r\n$11\r\nunsubscribe\r\n$2\r\nch\r\n:0\r\n',
              'latin1',
            ),
          );

          return;
        }

        socket.write(Buffer.from('+OK\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, { commandTimeout: 1000 }),
        ),
      );

      await client.connect();
      await client.subscribe('ch');
      await client.unsubscribe();

      const unsubFrame = await waitFor(
        () => received.find((frame) => frame.includes('UNSUBSCRIBE')),
        { description: 'UNSUBSCRIBE frame to arrive at mock server' },
      );

      assert.strictEqual(
        unsubFrame,
        '*2\r\n$11\r\nUNSUBSCRIBE\r\n$2\r\nch\r\n',
      );
    });

    it('expands an empty SUNSUBSCRIBE to include all subscribed shard channels', async () => {
      const server = await startMockServer();

      const received: string[] = [];

      server.onData((socket, data) => {
        const text = data.toString();
        received.push(text);

        if (text.includes('SSUBSCRIBE') && !text.includes('SUNSUBSCRIBE')) {
          socket.write(
            Buffer.from(
              '*3\r\n$10\r\nssubscribe\r\n$5\r\nsh.ch\r\n:1\r\n',
              'latin1',
            ),
          );

          return;
        }

        if (text.includes('SUNSUBSCRIBE')) {
          socket.write(
            Buffer.from(
              '*3\r\n$12\r\nsunsubscribe\r\n$5\r\nsh.ch\r\n:0\r\n',
              'latin1',
            ),
          );

          return;
        }

        socket.write(Buffer.from('+OK\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, { commandTimeout: 1000 }),
        ),
      );

      await client.connect();
      await client.ssubscribe('sh.ch');
      await client.sunsubscribe();

      const sunsubFrame = await waitFor(
        () => received.find((frame) => frame.includes('SUNSUBSCRIBE')),
        { description: 'SUNSUBSCRIBE frame to arrive at mock server' },
      );

      assert.strictEqual(
        sunsubFrame,
        '*2\r\n$12\r\nSUNSUBSCRIBE\r\n$5\r\nsh.ch\r\n',
      );
    });

    it('expands an empty PUNSUBSCRIBE to include all subscribed patterns', async () => {
      const server = await startMockServer();

      const received: string[] = [];

      server.onData((socket, data) => {
        const text = data.toString();
        received.push(text);

        if (text.includes('PSUBSCRIBE') && !text.includes('PUNSUBSCRIBE')) {
          socket.write(
            Buffer.from(
              '*3\r\n$10\r\npsubscribe\r\n$4\r\nch.*\r\n:1\r\n',
              'latin1',
            ),
          );

          return;
        }

        if (text.includes('PUNSUBSCRIBE')) {
          socket.write(
            Buffer.from(
              '*3\r\n$12\r\npunsubscribe\r\n$4\r\nch.*\r\n:0\r\n',
              'latin1',
            ),
          );

          return;
        }

        socket.write(Buffer.from('+OK\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, { commandTimeout: 1000 }),
        ),
      );

      await client.connect();
      await client.psubscribe('ch.*');
      await client.punsubscribe();

      const punsubFrame = await waitFor(
        () => received.find((frame) => frame.includes('PUNSUBSCRIBE')),
        { description: 'PUNSUBSCRIBE frame to arrive at mock server' },
      );

      assert.strictEqual(
        punsubFrame,
        '*2\r\n$12\r\nPUNSUBSCRIBE\r\n$4\r\nch.*\r\n',
      );
    });
  });

  describe('RESP3 wire-level defensive guards with mock server', () => {
    const resp3HelloReply = Buffer.from(
      '%7\r\n$6\r\nserver\r\n$5\r\nredis\r\n$7\r\nversion\r\n$5\r\n7.0.0\r\n$5\r\nproto\r\n:3\r\n$2\r\nid\r\n:1\r\n$4\r\nmode\r\n$10\r\nstandalone\r\n$4\r\nrole\r\n$6\r\nmaster\r\n$7\r\nmodules\r\n*0\r\n',
      'latin1',
    );

    it('throws SolidisCommandError when RESP3 TS.MRANGE Map value is not an array', async () => {
      const server = await startMockServer();

      let handshakeDone = false;

      server.onData((socket, data) => {
        const text = data.toString();

        if (!handshakeDone && text.includes('HELLO')) {
          handshakeDone = true;
          socket.write(resp3HelloReply);

          return;
        }

        socket.write(
          Buffer.from('%1\r\n$3\r\nkey\r\n+not-an-array\r\n', 'latin1'),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, { protocol: 'RESP3' }),
        ),
      );

      await client.connect();

      await assert.rejects(
        () => client.tsMrange(0, 9999, { kind: 'test' }),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[TS.MRANGE 0 9999 FILTER kind=test] Invalid reply: not-an-array',
      );
    });

    it('throws SolidisCommandError when RESP3 TS.MRANGE Map samples field is not an array', async () => {
      const server = await startMockServer();

      let handshakeDone = false;

      server.onData((socket, data) => {
        const text = data.toString();

        if (!handshakeDone && text.includes('HELLO')) {
          handshakeDone = true;
          socket.write(resp3HelloReply);

          return;
        }

        socket.write(
          Buffer.from('%1\r\n$3\r\nkey\r\n*1\r\n+not-an-array\r\n', 'latin1'),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, { protocol: 'RESP3' }),
        ),
      );

      await client.connect();

      await assert.rejects(
        () => client.tsMrange(0, 9999, { kind: 'test' }),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[TS.MRANGE 0 9999 FILTER kind=test] Invalid reply: not-an-array',
      );
    });
  });

  describe('reply parser defensive guards with malformed server replies', () => {
    it('throws SolidisCommandError when SCAN returns a non-array reply', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+not-an-array\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        async () => {
          for await (const _ of client.scan()) {
            void _;
          }
        },
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[SCAN] Unexpected reply: not-an-array',
      );
    });

    it('throws SolidisCommandError when SCAN elements field is not an array', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*2\r\n$1\r\n0\r\n+not-array\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        async () => {
          for await (const _ of client.scan()) {
            void _;
          }
        },
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[SCAN] Invalid reply: not-array',
      );
    });

    it('throws SolidisCommandError when XREAD returns a non-array reply', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+not-an-array\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.xread(['stream'], ['0']),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[XREAD STREAMS stream 0] Unexpected reply: not-an-array',
      );
    });

    it('throws SolidisCommandError when XREAD stream item is malformed', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*1\r\n+scalar\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.xread(['stream'], ['0']),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[XREAD STREAMS stream 0] Invalid reply: scalar',
      );
    });

    it('throws SolidisCommandError when XREAD entries are not an array', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from('*1\r\n*2\r\n$6\r\nstream\r\n+bad\r\n', 'latin1'),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.xread(['stream'], ['0']),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[XREAD STREAMS stream 0] Invalid reply: bad',
      );
    });

    it('throws SolidisCommandError when XRANGE returns a non-array reply', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+not-an-array\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.xrange('stream', '-', '+'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[XRANGE stream - +] Unexpected reply: not-an-array',
      );
    });

    it('throws SolidisCommandError when a stream entry has wrong shape', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*1\r\n+scalar\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.xrange('stream', '-', '+'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[STREAM] Invalid reply: scalar',
      );
    });

    it('throws SolidisCommandError when TS.RANGE returns a non-array reply', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+not-an-array\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.tsRange('key', 0, 9999),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[TS.RANGE key 0 9999] Unexpected reply: not-an-array',
      );
    });

    it('throws SolidisCommandError when TS.RANGE has malformed samples', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*1\r\n+scalar\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.tsRange('key', 0, 9999),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[TS.RANGE key 0 9999] Invalid reply: scalar',
      );
    });

    it('throws SolidisCommandError when GEOSEARCH returns a non-array reply', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+not-an-array\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () =>
          client.geosearch(
            'key',
            { fromlonlat: { longitude: 0, latitude: 0 } },
            { byradius: { radius: 100, unit: 'KM' } },
          ),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[GEOSEARCH] Unexpected reply: not-an-array',
      );
    });

    it('throws SolidisCommandError when GEOSEARCH item is neither string nor array', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*1\r\n:999\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () =>
          client.geosearch(
            'key',
            { fromlonlat: { longitude: 0, latitude: 0 } },
            { byradius: { radius: 100, unit: 'KM' } },
          ),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[GEOSEARCH] Unexpected reply: 999',
      );
    });

    it('throws SolidisCommandError for a malformed LMPOP reply', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+not-an-array\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.lmpop(['key'], 'LEFT'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[LMPOP 1 key LEFT] Unexpected reply: not-an-array',
      );
    });

    it('throws SolidisCommandError when LMPOP key is not a string or buffer', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*2\r\n:999\r\n*1\r\n$1\r\na\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.lmpop(['key'], 'LEFT'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[LMPOP 1 key LEFT] Unexpected reply: 999',
      );
    });

    it('throws SolidisCommandError when LMPOP elements is not an array', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*2\r\n$3\r\nkey\r\n+bad\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.lmpop(['key'], 'LEFT'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[LMPOP 1 key LEFT] Unexpected reply: bad',
      );
    });

    it('throws SolidisCommandError for a non-array BF.SCANDUMP reply', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+not-an-array\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.bfScandump('key', 0),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[BF.SCANDUMP key 0] Unexpected reply: not-an-array',
      );
    });

    it('throws SolidisCommandError for a scan dump with non-buffer data', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from('*2\r\n:42\r\n+string-not-buffer\r\n', 'latin1'),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.bfScandump('key', 0),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[BF.SCANDUMP key 0] Invalid reply: string-not-buffer',
      );
    });

    it('throws SolidisCommandError for a scan dump with unexpected null data', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*2\r\n:42\r\n$-1\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.bfScandump('key', 0),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[BF.SCANDUMP key 0] Invalid reply: null',
      );
    });

    it('throws SolidisCommandError when TS.MRANGE returns a non-array body', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+not-an-array\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.tsMrange(0, 9999, { kind: 'test' }),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[TS.MRANGE 0 9999 FILTER kind=test] Unexpected reply: not-an-array',
      );
    });

    it('throws SolidisCommandError when TS.MRANGE item has non-string key', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*1\r\n*2\r\n:999\r\n*1\r\n*2\r\n:1000\r\n:42\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.tsMrange(0, 9999, { kind: 'test' }),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[TS.MRANGE 0 9999 FILTER kind=test] Invalid reply: 999',
      );
    });

    it('throws SolidisCommandError when TS.MRANGE item has non-array samples', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from('*1\r\n*2\r\n$3\r\nkey\r\n+bad\r\n', 'latin1'),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.tsMrange(0, 9999, { kind: 'test' }),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[TS.MRANGE 0 9999 FILTER kind=test] Invalid reply: bad',
      );
    });

    it('throws SolidisCommandError when TS.MRANGE item is not an array', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*1\r\n+scalar\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.tsMrange(0, 9999, { kind: 'test' }),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[TS.MRANGE 0 9999 FILTER kind=test] Invalid reply: scalar',
      );
    });

    it('throws SolidisCommandError when time series samples contain NaN values', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*1\r\n*2\r\n$3\r\nkey\r\n*1\r\n*2\r\n$3\r\nNaN\r\n$3\r\nNaN\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.tsMrange(0, 9999, { kind: 'test' }),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[TS.MRANGE 0 9999 FILTER kind=test] Invalid reply: NaN/NaN',
      );
    });

    it('throws SolidisCommandError when MODULE LIST entry is not array or map', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*1\r\n+scalar\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.moduleList(),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[MODULE] Unexpected reply: scalar',
      );
    });

    it('throws SolidisCommandError when MODULE LIST entry lacks name or version', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*1\r\n*0\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.moduleList(),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[MODULE] Invalid reply: Missing required MODULE fields: ',
      );
    });

    it('parses GEOSEARCH WITHHASH when hash is a bulk string', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*1\r\n*4\r\n$7\r\nPalermo\r\n$6\r\n190.44\r\n$16\r\n3479099956230698\r\n*2\r\n$9\r\n13.361389\r\n$9\r\n38.115556\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      const results = await client.geosearch(
        'key',
        { fromlonlat: { longitude: 15, latitude: 37 } },
        { byradius: { radius: 400, unit: 'KM' } },
        { withCoord: true, withDist: true, withHash: true },
      );

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].member, 'Palermo');
      assert.strictEqual(results[0].hash, 3479099956230698);
      assert.strictEqual(results[0].distance, 190.44);
      assert.deepStrictEqual(results[0].position, {
        longitude: 13.361389,
        latitude: 38.115556,
      });
    });
  });

  describe('command-level reply guards with mock server', () => {
    it('parses ROLE master reply with connected replicas', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*3\r\n$6\r\nmaster\r\n:100\r\n*1\r\n*3\r\n$9\r\n127.0.0.1\r\n$4\r\n6380\r\n$3\r\n100\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      const result = await client.role();

      assert.strictEqual(result.role, 'master');
      assert.strictEqual(result.replicationOffset, 100);
      assert.strictEqual(result.slaves.length, 1);
      assert.strictEqual(result.slaves[0].ip, '127.0.0.1');
      assert.strictEqual(result.slaves[0].port, 6380);
      assert.strictEqual(result.slaves[0].offset, 100);
    });

    it('parses ROLE slave reply', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*5\r\n$5\r\nslave\r\n$9\r\n127.0.0.1\r\n:6379\r\n$9\r\nconnected\r\n:500\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      const result = await client.role();

      assert.strictEqual(result.role, 'slave');
      assert.strictEqual(result.masterHost, '127.0.0.1');
      assert.strictEqual(result.masterPort, 6379);
      assert.strictEqual(result.replicationState, 'connected');
      assert.strictEqual(result.replicationOffset, 500);
    });

    it('throws SolidisCommandError for unknown ROLE type', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*2\r\n$8\r\nsentinel\r\n*0\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.role(),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[ROLE] Unexpected reply: sentinel,',
      );
    });

    it('throws SolidisCommandError for ROLE master with invalid offset', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from('*3\r\n$6\r\nmaster\r\n$3\r\nbad\r\n*0\r\n', 'latin1'),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.role(),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[ROLE] Invalid reply: master,bad,',
      );
    });

    it('throws SolidisCommandError for malformed XPENDING summary', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+not-array\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.xpending('stream', 'grp'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[XPENDING stream grp] Unexpected reply: not-array',
      );
    });

    it('throws SolidisCommandError for XPENDING summary with wrong length', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*2\r\n:0\r\n$1\r\n0\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.xpending('stream', 'grp'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[XPENDING stream grp] Invalid reply: 0,0',
      );
    });

    it('throws SolidisCommandError for XPENDING summary with non-array consumers', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*4\r\n:1\r\n$3\r\n1-1\r\n$3\r\n1-1\r\n+bad\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.xpending('stream', 'grp'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[XPENDING stream grp] Invalid reply: bad',
      );
    });

    it('throws SolidisCommandError for XPENDING summary with malformed consumer tuple', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*4\r\n:1\r\n$3\r\n1-1\r\n$3\r\n1-1\r\n*1\r\n+only-one\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.xpending('stream', 'grp'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[XPENDING stream grp] Invalid reply: only-one',
      );
    });

    it('throws SolidisCommandError for XPENDING range with malformed entry', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*1\r\n+scalar\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.xpending('stream', 'grp', '-', '+', 10),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[XPENDING stream grp - + 10] Invalid reply: scalar',
      );
    });

    it('throws SolidisCommandError for COMMAND GETKEYSANDFLAGS with malformed item', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*1\r\n+scalar\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.commandGetkeysandflags('SET', ['k', 'v']),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[COMMAND GETKEYSANDFLAGS SET k v] Invalid reply: scalar',
      );
    });

    it('throws SolidisCommandError for COMMAND GETKEYSANDFLAGS with non-string key', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from('*1\r\n*2\r\n:999\r\n*1\r\n$2\r\nRW\r\n', 'latin1'),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.commandGetkeysandflags('SET', ['k', 'v']),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[COMMAND GETKEYSANDFLAGS SET k v] Invalid reply: 999',
      );
    });

    it('throws SolidisCommandError for COMMAND GETKEYSANDFLAGS with non-array reply', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+not-array\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.commandGetkeysandflags('SET', ['k', 'v']),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[COMMAND GETKEYSANDFLAGS SET k v] Unexpected reply: not-array',
      );
    });

    it('throws SolidisCommandError for LATENCY HISTOGRAM with non-array non-Map reply', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+scalar\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.latencyHistogram('ping'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[LATENCY HISTOGRAM ping] Unexpected reply: scalar',
      );
    });

    it('throws SolidisCommandError for LATENCY HISTOGRAM RESP2 with malformed event data', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from('*2\r\n$4\r\nping\r\n*2\r\n:1\r\n:2\r\n', 'latin1'),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.latencyHistogram('ping'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[LATENCY HISTOGRAM ping] Invalid reply: 1,2',
      );
    });

    it('throws SolidisCommandError for LATENCY HISTOGRAM RESP3 with non-Map histogram_usec', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*2\r\n$4\r\nping\r\n*4\r\n$5\r\ncalls\r\n:10\r\n$14\r\nhistogram_usec\r\n+bad\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.latencyHistogram('ping'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[LATENCY HISTOGRAM ping] Invalid reply: bad',
      );
    });

    it('throws SolidisCommandError for ACL GETUSER with scalar reply', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+scalar\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.aclGetuser('default'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[ACL GETUSER default] Unexpected reply: scalar',
      );
    });

    it('throws SolidisCommandError for ACL GETUSER with missing flags/passwords', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*0\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.aclGetuser('default'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[ACL GETUSER default] Invalid reply: flags & passwords required',
      );
    });

    it('throws SolidisCommandError for TS.MGET RESP2 with malformed item', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*1\r\n+scalar\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.tsMget({ kind: 'test' }),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[TS.MGET FILTER kind=test] Invalid reply: scalar',
      );
    });

    it('throws SolidisCommandError for TS.MGET RESP2 with non-string key', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*1\r\n*3\r\n:999\r\n*0\r\n*2\r\n:1000\r\n:42\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.tsMget({ kind: 'test' }),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[TS.MGET FILTER kind=test] Invalid reply: 999',
      );
    });

    it('throws SolidisCommandError for TS.MGET RESP2 with malformed sample', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from('*1\r\n*3\r\n$3\r\nkey\r\n*0\r\n+bad\r\n', 'latin1'),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.tsMget({ kind: 'test' }),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[TS.MGET FILTER kind=test] Invalid reply: bad',
      );
    });

    it('throws SolidisCommandError for TS.MGET with non-array non-Map reply', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+scalar\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.tsMget({ kind: 'test' }),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[TS.MGET FILTER kind=test] Unexpected reply: scalar',
      );
    });

    it('throws SolidisCommandError for ROLE master with malformed slave entry', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*3\r\n$6\r\nmaster\r\n:100\r\n*1\r\n+not-an-array\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.role(),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[ROLE] Invalid reply: master,100,not-an-array',
      );
    });

    it('parses XPENDING summary with null consumers (empty group)', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from('*4\r\n:0\r\n$-1\r\n$-1\r\n$-1\r\n', 'latin1'),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      const result = await client.xpending('stream', 'grp');

      assert.ok(!Array.isArray(result));
      assert.strictEqual(result.pending, 0);
      assert.strictEqual(result.minId, null);
      assert.strictEqual(result.maxId, null);
      assert.deepStrictEqual(result.consumers, []);
    });

    it('throws SolidisCommandError for XINFO STREAM FULL with non-array entries', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*18\r\n$6\r\nlength\r\n:1\r\n$15\r\nradix-tree-keys\r\n:1\r\n$16\r\nradix-tree-nodes\r\n:1\r\n$17\r\nlast-generated-id\r\n$3\r\n1-1\r\n$20\r\nmax-deleted-entry-id\r\n$3\r\n0-0\r\n$13\r\nentries-added\r\n:1\r\n$6\r\ngroups\r\n:0\r\n$23\r\nrecorded-first-entry-id\r\n$3\r\n0-0\r\n$7\r\nentries\r\n+bad\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.xinfoStream('stream', true),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[XINFO STREAM stream FULL] Invalid reply: bad',
      );
    });

    it('throws SolidisCommandError for LATENCY HISTOGRAM RESP3 Map with non-Map inner value', async () => {
      const helloRequest = Buffer.from('HELLO');
      let handshakeDone = false;

      const server = await startMockServer();

      server.onData((socket, data) => {
        if (!handshakeDone && data.includes(helloRequest)) {
          handshakeDone = true;

          socket.write(
            Buffer.from(
              '%7\r\n$6\r\nserver\r\n$5\r\nredis\r\n$7\r\nversion\r\n$5\r\n7.0.0\r\n$5\r\nproto\r\n:3\r\n$2\r\nid\r\n:1\r\n$4\r\nmode\r\n$10\r\nstandalone\r\n$4\r\nrole\r\n$6\r\nmaster\r\n$7\r\nmodules\r\n*0\r\n',
              'latin1',
            ),
          );

          return;
        }

        socket.write(
          Buffer.from('%1\r\n$4\r\nping\r\n+not-a-map\r\n', 'latin1'),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient({
          ...mockClientOptions(server.port),
          protocol: 'RESP3',
        }),
      );

      await client.connect();

      await assert.rejects(
        () => client.latencyHistogram('ping'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[LATENCY HISTOGRAM ping] Invalid reply: not-a-map',
      );
    });

    it('throws SolidisCommandError for ACL GETUSER selectors with non-array item', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*12\r\n$5\r\nflags\r\n*1\r\n$2\r\non\r\n$9\r\npasswords\r\n*0\r\n$8\r\ncommands\r\n$5\r\n+@all\r\n$4\r\nkeys\r\n$2\r\n~*\r\n$8\r\nchannels\r\n$2\r\n&*\r\n$9\r\nselectors\r\n*1\r\n+bad\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.aclGetuser('default'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[ACL GETUSER default] Invalid reply: bad',
      );
    });

    it('throws SolidisCommandError for TS.MGET RESP3 Map with non-array value', async () => {
      const helloRequest = Buffer.from('HELLO');
      let handshakeDone = false;

      const server = await startMockServer();

      server.onData((socket, data) => {
        if (!handshakeDone && data.includes(helloRequest)) {
          handshakeDone = true;

          socket.write(
            Buffer.from(
              '%7\r\n$6\r\nserver\r\n$5\r\nredis\r\n$7\r\nversion\r\n$5\r\n7.0.0\r\n$5\r\nproto\r\n:3\r\n$2\r\nid\r\n:1\r\n$4\r\nmode\r\n$10\r\nstandalone\r\n$4\r\nrole\r\n$6\r\nmaster\r\n$7\r\nmodules\r\n*0\r\n',
              'latin1',
            ),
          );

          return;
        }

        socket.write(
          Buffer.from('%1\r\n$3\r\nkey\r\n+not-an-array\r\n', 'latin1'),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient({
          ...mockClientOptions(server.port),
          protocol: 'RESP3',
        }),
      );

      await client.connect();

      await assert.rejects(
        () => client.tsMget({ kind: 'test' }),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[TS.MGET FILTER kind=test] Invalid reply: not-an-array',
      );
    });

    it('throws SolidisCommandError for TS.MGET RESP3 Map with malformed sample', async () => {
      const helloRequest = Buffer.from('HELLO');
      let handshakeDone = false;

      const server = await startMockServer();

      server.onData((socket, data) => {
        if (!handshakeDone && data.includes(helloRequest)) {
          handshakeDone = true;

          socket.write(
            Buffer.from(
              '%7\r\n$6\r\nserver\r\n$5\r\nredis\r\n$7\r\nversion\r\n$5\r\n7.0.0\r\n$5\r\nproto\r\n:3\r\n$2\r\nid\r\n:1\r\n$4\r\nmode\r\n$10\r\nstandalone\r\n$4\r\nrole\r\n$6\r\nmaster\r\n$7\r\nmodules\r\n*0\r\n',
              'latin1',
            ),
          );

          return;
        }

        socket.write(
          Buffer.from('%1\r\n$3\r\nkey\r\n*1\r\n+not-a-pair\r\n', 'latin1'),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient({
          ...mockClientOptions(server.port),
          protocol: 'RESP3',
        }),
      );

      await client.connect();

      await assert.rejects(
        () => client.tsMget({ kind: 'test' }),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[TS.MGET FILTER kind=test] Invalid reply: not-a-pair',
      );
    });

    it('throws SolidisCommandError for XINFO STREAM FULL with non-array groups', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*18\r\n$6\r\nlength\r\n:1\r\n$15\r\nradix-tree-keys\r\n:1\r\n$16\r\nradix-tree-nodes\r\n:1\r\n$17\r\nlast-generated-id\r\n$3\r\n1-1\r\n$20\r\nmax-deleted-entry-id\r\n$3\r\n0-0\r\n$13\r\nentries-added\r\n:1\r\n$6\r\ngroups\r\n+bad\r\n$23\r\nrecorded-first-entry-id\r\n$3\r\n0-0\r\n$7\r\nentries\r\n*0\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.xinfoStream('stream', true),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[XINFO STREAM stream FULL] Invalid reply: bad',
      );
    });
  });

  describe('latency and slowlog parsing with mock server', () => {
    it('parses LATENCY LATEST with populated event entries', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*1\r\n*4\r\n$7\r\ncommand\r\n:1718700000\r\n:5\r\n:20\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      const result = await client.latencyLatest();

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].event, 'command');
      assert.strictEqual(result[0].timestamp, 1718700000);
      assert.strictEqual(result[0].latency, 5);
      assert.strictEqual(result[0].maximumLatency, 20);
    });

    it('parses LATENCY HISTORY with populated entries', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*2\r\n*2\r\n:1718700000\r\n:5\r\n*2\r\n:1718700001\r\n:10\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      const result = await client.latencyHistory('command');

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].timestamp, 1718700000);
      assert.strictEqual(result[0].latency, 5);
      assert.strictEqual(result[1].timestamp, 1718700001);
      assert.strictEqual(result[1].latency, 10);
    });

    it('throws SolidisCommandError for LATENCY LATEST with malformed entry', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*1\r\n+bad\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.latencyLatest(),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[LATENCY LATEST] Invalid reply: bad',
      );
    });

    it('throws SolidisCommandError for LATENCY HISTORY with malformed entry', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('*1\r\n*2\r\n+bad\r\n+bad\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.latencyHistory('command'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[LATENCY HISTORY command] Invalid reply: bad,bad',
      );
    });

    it('throws SolidisCommandError for LATENCY LATEST with non-array reply', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+scalar\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.latencyLatest(),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message === '[LATENCY LATEST] Unexpected reply: scalar',
      );
    });

    it('throws SolidisCommandError for LATENCY HISTORY with non-array reply', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+scalar\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(
        () => client.latencyHistory('command'),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[LATENCY HISTORY command] Unexpected reply: scalar',
      );
    });

    it('parses SLOWLOG GET with structured entries via mock', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(
          Buffer.from(
            '*1\r\n*6\r\n:1\r\n:1718700000\r\n:5000\r\n*2\r\n$4\r\nPING\r\n$0\r\n\r\n$9\r\n127.0.0.1\r\n$5\r\nmyapp\r\n',
            'latin1',
          ),
        );
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      const result = await client.slowlogGet();

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].id, 1);
      assert.strictEqual(result[0].timestamp, 1718700000);
      assert.strictEqual(result[0].duration, 5000);
      assert.deepStrictEqual(result[0].commandArguments, ['PING', '']);
      assert.strictEqual(result[0].clientIpPort, '127.0.0.1');
      assert.strictEqual(result[0].clientName, 'myapp');
    });
  });

  describe('requester socket write paths', () => {
    it('rejects when server pauses and command timeout fires', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.pause();
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            maxSocketWriteSizePerOnce: 32,
            commandTimeout: 200,
            autoReconnect: false,
          }),
        ),
      );

      await client.connect();

      const result = await client
        .send(buildLargeEchoCommands(50, 200))
        .catch((error: Error) => error);

      assert.ok(result instanceof SolidisRequesterError);
      assert.strictEqual(
        result.message,
        'Solidis command(s) timed out after 200 ms.',
      );
    });

    it('rejects with connection error when the server drops during a backpressured write', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.pause();
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            maxSocketWriteSizePerOnce: 32,
            socketWriteTimeout: 5000,
            autoReconnect: false,
          }),
        ),
      );

      await client.connect();

      const pending = client
        .send(buildLargeEchoCommands(50, 200))
        .catch((error: Error) => error);

      await waitFor(() => server.received.length > 0, {
        description: 'client started writing to the paused mock server',
      });

      server.destroySockets();

      const result = await pending;

      assert.ok(result instanceof SolidisClientError);
      assert.strictEqual(
        result.message,
        'SolidisConnectionError: Solidis connection closed.',
      );
    });
  });

  describe('requester inflight guard paths', () => {
    it('silently discards replies when the inflight queue is empty', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.write(Buffer.from('+OK\r\n+EXTRA\r\n+EXTRA2\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      const result = await client.send([['PING']]);

      assert.deepStrictEqual(result, [['OK']]);

      const probe = await client.send([['PING']]);

      assert.deepStrictEqual(probe, [['OK']]);
    });

    it('rejects unsent requests held in the schedule queue on fault recovery', async () => {
      const { SolidisRequester } = await import(
        '../../../../sources/modules/requester.ts'
      );
      const { SolidisPubSub } = await import(
        '../../../../sources/modules/pubsub.ts'
      );
      const { SolidisDefaultOptions } = await import(
        '../../../../sources/common/constants.ts'
      );

      const mockConnection = {
        socket: null,
        reset() {},
      };

      const requester = new SolidisRequester({
        ...SolidisDefaultOptions,
        connection: mockConnection as never,
        pubSub: new SolidisPubSub(),
      });

      const pending = requester
        .send([['QUEUED-CMD']])
        .catch((error: Error) => error);

      requester.recoveryFromFault(new Error('forced recovery'));

      const result = await pending;

      assert.ok(result instanceof Error);
      assert.strictEqual(result.message, 'forced recovery');
    });

    it('rejects pipeline when socket becomes null during flush', async () => {
      const { SolidisRequester } = await import(
        '../../../../sources/modules/requester.ts'
      );
      const { SolidisPubSub } = await import(
        '../../../../sources/modules/pubsub.ts'
      );
      const { SolidisDefaultOptions } = await import(
        '../../../../sources/common/constants.ts'
      );

      const mockConnection = {
        socket: null,
        reset() {},
      };

      const requester = new SolidisRequester({
        ...SolidisDefaultOptions,
        connection: mockConnection as never,
        pubSub: new SolidisPubSub(),
      });

      const result = await requester
        .send([['WILL-FAIL']])
        .catch((error: Error) => error);

      assert.ok(result instanceof SolidisRequesterError);
      assert.strictEqual(result.message, 'Socket is not connected');
    });

    it('consumes remaining replies for a timed-out pipeline without desync', async () => {
      const server = await startMockServer();

      let commandIndex = 0;

      server.onData((socket) => {
        commandIndex += 1;

        if (commandIndex === 1) {
          return;
        }

        socket.write(Buffer.from('+SECOND\r\n', 'latin1'));

        setImmediate(() => {
          socket.write(Buffer.from('+LATE-FIRST\r\n', 'latin1'));
        });
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            commandTimeout: 500,
            autoReconnect: false,
          }),
        ),
      );

      await client.connect();

      const firstResult = await client
        .send([['SLOW']])
        .catch((error: Error) => ({ rejected: true, error }));

      assert.ok(
        typeof firstResult === 'object' &&
          firstResult !== null &&
          'rejected' in firstResult &&
          firstResult.rejected === true,
        'first command must be rejected by timeout',
      );
      assert.ok(firstResult.error instanceof SolidisRequesterError);
      assert.strictEqual(
        firstResult.error.message,
        'Solidis command(s) timed out after 500 ms.',
      );

      const second = await client.send([['FAST']]);

      assert.deepStrictEqual(
        second,
        [['SECOND']],
        'second command must get its own reply, not the late first reply',
      );
    });

    it('drains every reply for a timed-out multi-command pipeline', async () => {
      const server = await startMockServer();

      let replyCount = 0;

      server.onData(() => {
        replyCount += 1;
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            commandTimeout: 100,
            autoReconnect: false,
          }),
        ),
      );

      await client.connect();

      const pending = client
        .send([['SLOW-A'], ['SLOW-B'], ['SLOW-C']])
        .catch((error: Error) => ({ rejected: true as const, error }));

      const timedOut = await pending;

      assert.ok(
        typeof timedOut === 'object' &&
          timedOut !== null &&
          'rejected' in timedOut &&
          timedOut.rejected === true,
        'multi-command pipeline must reject once commandTimeout expires',
      );
      assert.ok(timedOut.error instanceof SolidisRequesterError);
      assert.strictEqual(
        timedOut.error.message,
        'Solidis command(s) timed out after 100 ms.',
      );

      server.send(Buffer.from('+A\r\n+B\r\n+C\r\n', 'latin1'));

      await waitFor(() => replyCount >= 1, {
        description: 'client must receive late replies before next command',
      });

      server.onData((socket) => {
        socket.write(Buffer.from('+OK\r\n', 'latin1'));
      });

      assert.deepStrictEqual(await client.send([['PING']]), [['OK']]);
    });

    it('rejects with socketWriteTimeout error when socket never drains', async () => {
      const server = await startMockServer();

      server.onData((socket) => {
        socket.pause();
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            maxSocketWriteSizePerOnce: 1,
            socketWriteTimeout: 100,
            commandTimeout: 5000,
            autoReconnect: false,
          }),
        ),
      );

      await client.connect();

      const result = await client
        .send(buildLargeEchoCommands(100, 500))
        .catch((error: Error) => error);

      assert.ok(result instanceof SolidisRequesterError);
      assert.strictEqual(
        result.message,
        'Solidis command(s) timed out after 5000 ms.',
      );
    });

    it('rejects when socket emits error during chunked write', async () => {
      const server = await startMockServer();

      let dataCount = 0;

      server.onData((socket) => {
        dataCount += 1;

        if (dataCount >= 2) {
          socket.destroy(new Error('forced socket error'));
        }
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            maxSocketWriteSizePerOnce: 16,
            commandTimeout: 3000,
            autoReconnect: false,
          }),
        ),
      );

      await client.connect();

      const result = await client
        .send(buildLargeEchoCommands(50, 200))
        .catch((error: Error) => error);

      assert.ok(result instanceof SolidisRequesterError);
      assert.strictEqual(
        result.message,
        'Solidis command(s) timed out after 3000 ms.',
      );
    });

    it('receives late replies for a timed-out pipeline and keeps sync', async () => {
      const server = await startMockServer();

      let lateRepliesSent = false;

      server.onData((socket, _data, _server) => {
        if (!lateRepliesSent) {
          return;
        }

        socket.write(Buffer.from('+FRESH\r\n', 'latin1'));
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(
          mockClientOptions(server.port, {
            commandTimeout: 200,
            autoReconnect: false,
          }),
        ),
      );

      await client.connect();

      const timedOutResult = await client
        .send([['SLOW-A'], ['SLOW-B']])
        .catch((error: Error) => ({ timedOut: true, error }));

      assert.ok(
        typeof timedOutResult === 'object' &&
          timedOutResult !== null &&
          'timedOut' in timedOutResult &&
          timedOutResult.timedOut === true,
        'two-command pipeline must time out when server withholds replies',
      );
      assert.ok(timedOutResult.error instanceof SolidisRequesterError);
      assert.strictEqual(
        timedOutResult.error.message,
        'Solidis command(s) timed out after 200 ms.',
      );

      server.send(Buffer.from('+LATE-1\r\n+LATE-2\r\n', 'latin1'));
      lateRepliesSent = true;

      await new Promise<void>((resolve) => setImmediate(resolve));

      const freshResult = await client.send([['FAST']]);

      assert.deepStrictEqual(
        freshResult,
        [['FRESH']],
        'next command must get its own reply after timed-out pipeline is drained',
      );
    });
  });
});

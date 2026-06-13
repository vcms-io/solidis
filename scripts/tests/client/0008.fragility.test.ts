/**
 * Fragility & recovery.
 *
 * Three angles, all aimed at "what happens when things go wrong":
 *
 *  1. Hostile *payloads* sent to a real server (empty frames, binary bytes,
 *     bogus command names, wrong arity) must never corrupt the client's
 *     pipeline — a normal command issued right after must still work.
 *  2. Hostile *bytes from the server* (unknown RESP prefixes, truncated frames,
 *     unsolicited replies, abrupt socket loss) are simulated with a scriptable
 *     mock server to confirm the client fails loudly and stays correlated.
 *  3. Faults that break the connection mid-flight reject the in-flight work
 *     deterministically, and the client either recovers (auto-reconnect) or
 *     stays permanently closed (after quit) — with explicit accounting of how
 *     much in-flight work is lost across the fault boundary.
 */

import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../sources/client/featured.ts';
import {
  RespError,
  SolidisClientError,
  SolidisParserError,
} from '../../../sources/index.ts';
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
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('fragility', () => {
  const keyspace = createKeyspace('fragility');

  /** Clients/servers created outside createClient() must be torn down here. */
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
      client = await createClient({ commandTimeout: 800 });
    });

    after(async () => {
      await closeClient(client);
    });

    /** Issued after every hostile payload to prove the pipeline is intact. */
    const assertStillHealthy = async (probe: string) => {
      const key = keyspace.key('healthy', probe);

      assert.strictEqual(await client.set(key, probe), 'OK');
      assert.strictEqual(await client.get(key), probe);
    };

    it('recovers from an empty command frame via timeout', async () => {
      /**
       * An empty argument vector serialises to `*0\r\n`, which the server
       * silently ignores (no reply). The command must therefore time out, the
       * requester must recover, and the next command must succeed.
       */
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
      /** Every command produced exactly one reply slot, in order. */
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

      /** Garbage reply means no usable frame, so the command times out. */
      await assert.rejects(
        () => client.ping(),
        (error: Error) => /timed out/i.test(error.message),
      );

      await waitFor(() => parserErrors.length > 0, {
        timeout: 1000,
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
          /** One extra, unsolicited reply trails the legitimate one. */
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

      /**
       * If the stray `+UNSOLICITED` had been mis-attributed, the second command
       * would resolve to it instead of `+SECOND`.
       */
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
        /** Send a truncated bulk header, then drop the socket. */
        socket.write(Buffer.from('$100\r\npartial', 'latin1'));
        setTimeout(() => socket.destroy(), 10);
      });

      const client = trackMockClient(
        new SolidisFeaturedClient(mockClientOptions(server.port)),
      );

      await client.connect();

      await assert.rejects(() => client.get(keyspace.key('vanish')));
    });
  });

  describe('fault recovery and data-loss accounting', () => {
    it('rejects in-flight work and recovers after a forced disconnect', async () => {
      const client = await createClient({
        autoReconnect: true,
        maxConnectionRetries: 5,
        connectionRetryDelay: 50,
      });

      client.on('error', () => {});

      const blockKey = keyspace.key('recover-block');
      const liveKey = keyspace.key('recover-live');

      await client.set(liveKey, 'before');

      const clientId = await client.clientId();
      const killer = await createClient();

      /** BLPOP is guaranteed in-flight until the kill lands. */
      const blocked = client
        .blpop([blockKey], 0)
        .then(() => false)
        .catch(() => true);

      await delay(50);
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
        { timeout: 3000, interval: 50, description: 'auto-reconnect' },
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
        connectionRetryDelay: 50,
      });

      client.on('error', () => {});

      const total = 1500;
      const clientId = await client.clientId();
      const killer = await createClient();

      const outcomes = range(total).map((index) =>
        client
          .set(keyspace.key('loss', index), `${index}`)
          .then(() => 'resolved' as const)
          .catch(() => 'rejected' as const),
      );

      /** Kill the connection while the batch is still draining. */
      await killer.clientKill(clientId);

      const settled = await Promise.all(outcomes);
      const resolved = settled.filter((value) => value === 'resolved').length;
      const rejected = settled.filter((value) => value === 'rejected').length;

      /** Invariant 1: no command promise is ever silently dropped. */
      assert.strictEqual(resolved + rejected, total);

      await waitFor(
        async () => {
          try {
            return (await client.ping()) === 'PONG';
          } catch {
            return false;
          }
        },
        { timeout: 3000, interval: 50, description: 'auto-reconnect' },
      );

      let persisted = 0;

      for (const index of range(total)) {
        if ((await client.get(keyspace.key('loss', index))) === `${index}`) {
          persisted += 1;
        }
      }

      /**
       * Invariant 2: every write the client *acknowledged* as resolved must be
       * durable on the server. Writes can also persist while their reply was
       * lost to the fault (rejected-but-applied), so persisted >= resolved; the
       * gap is exactly the work whose acknowledgement was lost in transit.
       */
      assert.ok(
        persisted >= resolved,
        `persisted (${persisted}) must cover resolved (${resolved})`,
      );
      assert.ok(persisted <= total);

      /** Invariant 3: the client is fully usable again after recovery. */
      assert.strictEqual(
        await client.set(keyspace.key('loss-final'), 'ok'),
        'OK',
      );

      await closeClient(killer);
      await closeClient(client);
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

      /** A second attempt fails the same way; no partial revival. */
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
});

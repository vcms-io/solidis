/**
 * Debug infrastructure and requester module internals: debug entries and
 * their formatting, requester fault recovery and pipeline chunking, and the
 * DEBUG command itself.
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { after, before, describe, it } from 'node:test';

import {
  commandsToBuffer,
  formatDebugLog,
  RespError,
  RespPush,
  SolidisClientError,
  SolidisCommandError,
  SolidisConnectionError,
  SolidisDefaultOptions,
  SolidisParserError,
  SolidisProtocols,
  SolidisPubSub,
  SolidisPubSubError,
  SolidisRequester,
  SolidisRequesterError,
} from '../../../../sources/index.ts';
import { SolidisSessionSendOptions } from '../../../../sources/modules/internal.ts';
import {
  closeClient,
  createClient,
  createKeyspace,
  delay,
  waitFor,
} from '../../utils/index.ts';

import type {
  SolidisClientEmit,
  SolidisClientFrozenOptions,
  SolidisDebugHandle,
  SolidisDebugLog,
  SolidisSendOptions,
} from '../../../../sources/index.ts';
import type { FeaturedClient } from '../../utils/index.ts';

describe('debug-requester', () => {
  let client: FeaturedClient;
  const keyspace = createKeyspace('debug-requester');

  before(async () => {
    client = await createClient();
  });

  after(async () => {
    await closeClient(client);
  });

  describe('debug entries', () => {
    it('delivers timestamped entries through the debug event only when debug is on', async () => {
      const debugging = await createClient({ debug: true });
      const quiet = await createClient();
      const entries: SolidisDebugLog[] = [];
      const silent: SolidisDebugLog[] = [];

      try {
        debugging.on('debug', (entry) => entries.push(entry));
        quiet.on('debug', (entry) => silent.push(entry));

        const startedAt = Date.now();

        await debugging.set(keyspace.key('debug-entry'), 'value');
        await quiet.set(keyspace.key('quiet-entry'), 'value');
        await delay(10);

        assert.ok(
          entries.some(
            ({ type, message }) =>
              type === 'debug' &&
              /^Requester serialized \d+ bytes: SET$/.test(message),
          ),
          JSON.stringify(entries.map(({ message }) => message)),
        );

        for (const entry of entries) {
          assert.ok(
            Number.isFinite(entry.timestamp) &&
              entry.timestamp >= startedAt &&
              entry.timestamp <= Date.now(),
            `expected a timestamp after ${startedAt}, got ${entry.timestamp}`,
          );
        }

        assert.deepStrictEqual(silent, []);
      } finally {
        await closeClient(debugging);
        await closeClient(quiet);
      }
    });

    it('formats a debug log with data', () => {
      assert.strictEqual(
        formatDebugLog({
          type: 'info',
          message: 'hello',
          data: { key: 'val' },
        }),
        "[Solidis info] hello { key: 'val' }\n",
      );
    });

    it('formats a debug log without data', () => {
      assert.strictEqual(
        formatDebugLog({ type: 'error', message: 'fail' }),
        '[Solidis error] fail\n',
      );
    });

    it('formats data that JSON cannot serialize', () => {
      const data: Record<string, unknown> = { value: 1n };

      data.self = data;

      assert.strictEqual(
        formatDebugLog({ type: 'debug', message: 'cyclic', data }),
        '[Solidis debug] cyclic <ref *1> { value: 1n, self: [Circular *1] }\n',
      );
    });
  });

  describe('debug command', () => {
    it('constructs DEBUG command with subcommand and parameters', async () => {
      const { createCommand } = await import(
        '../../../../sources/command/debug.ts'
      );

      const command = createCommand('SLEEP', '0');

      assert.deepStrictEqual(command, ['DEBUG', 'SLEEP', '0']);
    });

    it('handles DEBUG SLEEP 0 regardless of server configuration', async () => {
      try {
        assert.strictEqual(await client.debug('SLEEP', '0'), 'OK');
      } catch (error) {
        assert.ok(error instanceof SolidisCommandError);
        assert.match(
          error.message,
          /^\[DEBUG SLEEP\] ERR DEBUG command not allowed\./,
        );
        assert.ok(error.cause instanceof RespError);
      }
    });
  });

  describe('requester fault recovery', () => {
    it('rejects commands on socket disconnect', async () => {
      const faultyClient = await createClient({
        commandTimeout: 500,
        maxConnectionRetries: 0,
        autoReconnect: false,
      });

      const key = keyspace.key('requester-fault');

      assert.strictEqual(await faultyClient.set(key, 'value'), 'OK');

      faultyClient.quit();

      await assert.rejects(
        () => faultyClient.get(key),
        (error: Error) =>
          error instanceof SolidisClientError &&
          error.message === 'The client was quit.',
      );
    });

    it('handles empty command array gracefully', async () => {
      const result = await client.send([]);

      assert.deepStrictEqual(result, []);
    });

    it('recovers after fault and accepts new commands', async () => {
      const recoveryClient = await createClient({
        maxConnectionRetries: 5,
        connectionRetryDelay: 25,
        connectionTimeout: 500,
        autoReconnect: true,
      });

      recoveryClient.on('error', () => {});

      const key = keyspace.key('recovery-test');

      await recoveryClient.set(key, 'before');

      const clientId = await recoveryClient.clientId();
      const killer = await createClient();

      const reconnected = new Promise<void>((resolve) =>
        recoveryClient.once('ready', resolve),
      );

      await killer.clientKill(clientId);
      await reconnected;
      await closeClient(killer);

      assert.strictEqual(await recoveryClient.get(key), 'before');
      assert.strictEqual(await recoveryClient.set(key, 'after'), 'OK');
      assert.strictEqual(await recoveryClient.get(key), 'after');

      await closeClient(recoveryClient);
    });

    it('sends multiple commands in a single pipeline batch', async () => {
      const key1 = keyspace.key('batch-1');
      const key2 = keyspace.key('batch-2');

      const [result1, result2] = await Promise.all([
        client.set(key1, 'v1'),
        client.set(key2, 'v2'),
      ]);

      assert.strictEqual(result1, 'OK');
      assert.strictEqual(result2, 'OK');
    });
  });

  describe('requester pipeline chunking', () => {
    it('splits commands into chunks when exceeding maxCommandsPerPipeline', async () => {
      const chunkedClient = await createClient({
        maxCommandsPerPipeline: 2,
      });

      const key1 = keyspace.key('chunk-1');
      const key2 = keyspace.key('chunk-2');
      const key3 = keyspace.key('chunk-3');

      await chunkedClient.set(key1, 'a');
      await chunkedClient.set(key2, 'b');
      await chunkedClient.set(key3, 'c');

      const values = await Promise.all([
        chunkedClient.get(key1),
        chunkedClient.get(key2),
        chunkedClient.get(key3),
      ]);

      assert.deepStrictEqual(values, ['a', 'b', 'c']);

      await closeClient(chunkedClient);
    });
  });

  describe('requester command timeout', () => {
    it('rejects command when commandTimeout expires', async () => {
      const timeoutClient = await createClient({ commandTimeout: 50 });

      await assert.rejects(
        () =>
          timeoutClient.send([['BLPOP', keyspace.key('never-exists'), '0']]),
        (error: Error) =>
          error instanceof SolidisRequesterError &&
          error.message === 'Command(s) timed out after 50 ms.',
      );

      await closeClient(timeoutClient);
    });
  });

  describe('requester rejectOnPartialPipelineError', () => {
    it('rejects individual pipeline command on error when enabled', async () => {
      const strictClient = await createClient({
        rejectOnPartialPipelineError: true,
      });

      const key = keyspace.key('partial-error');

      await strictClient.set(key, 'hello');

      await assert.rejects(
        () => strictClient.incr(key),
        (error: Error) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[INCR] ERR value is not an integer or out of range' &&
          error.cause instanceof RespError &&
          error.cause.code === 'ERR',
      );

      await closeClient(strictClient);
    });
  });

  describe('requester large reply batches', () => {
    it('resolves thousands of replies delivered in large chunks', async () => {
      const key = keyspace.key('large-replies');
      const total = 5000;

      await client.set(key, 'base');

      const results = await client.send(
        Array.from({ length: total }, () => ['GET', key]),
      );

      assert.deepStrictEqual(
        results,
        Array.from({ length: total }, () => [Buffer.from('base')]),
      );
    });
  });

  describe('requester connection loss', () => {
    it('rejects a blocked command when the server kills the connection, then recovers', async () => {
      const faultClient = await createClient({
        autoReconnect: true,
        maxConnectionRetries: 3,
        connectionRetryDelay: 25,
        connectionTimeout: 500,
      });

      const key = keyspace.key('fault-recovery');
      const blockKey = keyspace.key('fault-block');

      await faultClient.set(key, 'initial');

      const clientId = await faultClient.clientId();
      const killerClient = await createClient();

      const settlement = faultClient.blpop([blockKey], 0).then(
        () => undefined,
        (error: unknown) => error,
      );

      await waitFor(
        async () =>
          (await killerClient.clientList())
            .split('\n')
            .some(
              (line) =>
                line.startsWith(`id=${clientId} `) &&
                line.includes('cmd=blpop'),
            ),
        {
          timeout: 2000,
          interval: 10,
          description: 'blpop registered on server',
        },
      );

      await killerClient.clientKill(clientId);

      const error = await settlement;

      assert.ok(error instanceof SolidisConnectionError);
      assert.strictEqual(error.message, 'Connection closed.');

      await waitFor(
        async () => {
          try {
            return (await faultClient.ping()) === 'PONG';
          } catch {
            return false;
          }
        },
        { timeout: 2000, interval: 30, description: 'reconnect after fault' },
      );

      assert.strictEqual(await faultClient.set(key, 'recovered'), 'OK');
      assert.strictEqual(await faultClient.get(key), 'recovered');
      assert.strictEqual(await killerClient.rpush(blockKey, 'kept'), 1);
      assert.strictEqual(await faultClient.llen(blockKey), 1);

      await closeClient(faultClient);
      await closeClient(killerClient);
    });
  });

  describe('requester internals', () => {
    class FakeConnection extends EventEmitter {
      public isConnected = true;
      public readonly writes: Buffer[] = [];
      public readonly resets: Error[] = [];

      public write(buffer: Buffer) {
        this.writes.push(buffer);
      }

      public reset(error: Error) {
        this.resets.push(error);
        this.isConnected = false;
        this.emit('close', error);
      }

      public reply(data: string) {
        this.emit('data', Buffer.from(data, 'latin1'));
      }
    }

    function createRequester(
      options: Partial<SolidisClientFrozenOptions> = {},
      listener?: (event: string) => void,
      debugHandle?: SolidisDebugHandle,
    ) {
      const connection = new FakeConnection();
      const events: unknown[][] = [];
      const emit = ((event: string, ...parameters: unknown[]) => {
        listener?.(event);
        events.push([event, ...parameters]);

        return true;
      }) as SolidisClientEmit;
      const pubSub = new SolidisPubSub(emit);
      const requester = new SolidisRequester({
        ...SolidisDefaultOptions,
        ...options,
        connection: connection as never,
        pubSub,
        emit,
        debugHandle,
      });

      return { connection, events, pubSub, requester };
    }

    function flushed() {
      return new Promise<void>((resolve) => setImmediate(resolve));
    }

    function settle(promise: Promise<unknown>) {
      return promise.then(
        () => undefined,
        (error: unknown) => error,
      );
    }

    function getEvents(events: unknown[][], name: string) {
      return events
        .filter(([event]) => event === name)
        .map(([, ...parameters]) => parameters);
    }

    function subscribeConfirmation(
      eventName: string,
      channel: string,
      count: number,
    ) {
      return `*3\r\n$${eventName.length}\r\n${eventName}\r\n$${channel.length}\r\n${channel}\r\n:${count}\r\n`;
    }

    it('hands a push shorter than a Pub/Sub event to push listeners', () => {
      const { connection, events } = createRequester();

      connection.reply('>2\r\n$7\r\nmessage\r\n$2\r\nch\r\n');

      assert.strictEqual(getEvents(events, 'push').length, 1);
      assert.deepStrictEqual(getEvents(events, 'error'), []);
    });

    it('coalesces requests sent in the same tick into one write', async () => {
      const { connection, requester } = createRequester();

      const first = requester.send([['SET', 'a', '1']]);
      const second = requester.send([['GET', 'a'], ['PING']]);

      await flushed();

      assert.deepStrictEqual(connection.writes, [
        commandsToBuffer([['SET', 'a', '1'], ['GET', 'a'], ['PING']]),
      ]);

      connection.reply('+OK\r\n$1\r\n1\r\n+PONG\r\n');

      assert.deepStrictEqual(await first, [['OK']]);
      assert.deepStrictEqual(await second, [[Buffer.from('1')], ['PONG']]);
    });

    it('splits a batch at maxCommandsPerPipeline', async () => {
      const { connection, requester } = createRequester({
        maxCommandsPerPipeline: 2,
      });

      const pending = requester.send(
        Array.from({ length: 5 }, (_, index) => ['ECHO', `${index}`]),
      );

      await flushed();

      assert.strictEqual(connection.writes.length, 3);

      connection.reply('+0\r\n+1\r\n+2\r\n+3\r\n+4\r\n');

      assert.deepStrictEqual(await pending, [
        ['0'],
        ['1'],
        ['2'],
        ['3'],
        ['4'],
      ]);
    });

    it('resolves replies delivered one byte at a time', async () => {
      const { connection, requester } = createRequester();

      const pending = requester.send([
        ['GET', 'k'],
        ['HGETALL', 'h'],
      ]);

      await flushed();

      for (const byte of Buffer.from(
        '$5\r\nvalue\r\n*2\r\n$1\r\nf\r\n$1\r\nv\r\n',
      )) {
        connection.emit('data', Buffer.from([byte]));
      }

      assert.deepStrictEqual(await pending, [
        [Buffer.from('value')],
        [[Buffer.from('f'), Buffer.from('v')]],
      ]);
    });

    it('reports a reply that arrives while nothing is pending', () => {
      const { connection, events } = createRequester();

      connection.reply('+UNSOLICITED\r\n-ERR unsolicited\r\n');

      const [[error], [refusal]] = getEvents(events, 'error');

      assert.ok(error instanceof SolidisRequesterError);
      assert.strictEqual(
        error.message,
        'Received reply with no pending request',
      );
      assert.strictEqual(error.cause, 'UNSOLICITED');
      assert.ok(refusal instanceof SolidisRequesterError);
      assert.ok(refusal.cause instanceof RespError);
    });

    it('delivers the replies a chunk held before a protocol error', async () => {
      const { connection, events, requester } = createRequester();

      const first = requester.send([['INCR', 'a']]);
      const second = requester.send([['INCR', 'b']]);
      const third = settle(requester.send([['GET', 'c']]));

      await flushed();

      connection.reply(':1\r\n:2\r\n?garbage\r\n');

      assert.deepStrictEqual(await first, [[1]]);
      assert.deepStrictEqual(await second, [[2]]);

      const error = await third;

      assert.ok(error instanceof SolidisParserError);
      assert.deepStrictEqual(connection.resets, [error]);
      assert.deepStrictEqual(getEvents(events, 'error'), [[error]]);
    });

    it('resets the connection and rejects pending requests on a protocol error', async () => {
      const { connection, events, requester } = createRequester();

      const pending = settle(requester.send([['GET', 'k']]));

      await flushed();

      connection.reply('?garbage\r\n');

      const error = await pending;

      assert.ok(error instanceof SolidisParserError);
      assert.strictEqual(error.message, "Unknown prefix '?'");
      assert.deepStrictEqual(connection.resets, [error]);
      assert.deepStrictEqual(getEvents(events, 'error'), [[error]]);
    });

    it('discards a partial frame when the connection closes', async () => {
      const { connection, requester } = createRequester();

      const lost = settle(requester.send([['GET', 'k']]));

      await flushed();

      connection.reply('$10\r\nhalf');
      connection.emit(
        'close',
        new SolidisConnectionError('Connection closed.'),
      );

      const error = await lost;

      assert.ok(error instanceof SolidisConnectionError);

      const next = requester.send([['PING']]);

      await flushed();

      connection.reply('+PONG\r\n');

      assert.deepStrictEqual(await next, [['PONG']]);
    });

    it('rejects in-flight requests with the close error and unsent ones as not connected', async () => {
      const { connection, requester } = createRequester({
        maxCommandsPerPipeline: 1,
      });

      const inflight = settle(
        requester.send([
          ['ECHO', 'a'],
          ['ECHO', 'b'],
        ]),
      );

      await flushed();

      assert.strictEqual(connection.writes.length, 2);

      const unflushed = settle(requester.send([['ECHO', 'c']]));
      const error = new SolidisConnectionError('Connection closed.');

      connection.emit('close', error);

      assert.strictEqual(await inflight, error);

      const unsent = await unflushed;

      assert.ok(unsent instanceof SolidisRequesterError);
      assert.strictEqual(unsent.message, 'Socket is not connected.');
      assert.strictEqual(unsent.cause, error);

      await flushed();

      assert.strictEqual(connection.writes.length, 2);
    });

    it('writes every pipeline of a flush without waiting for the socket to drain', async () => {
      const { connection, requester } = createRequester({
        maxCommandsPerPipeline: 1,
      });

      const pending = requester.send([
        ['ECHO', 'a'],
        ['ECHO', 'b'],
        ['ECHO', 'c'],
      ]);

      await flushed();

      assert.deepStrictEqual(connection.writes, [
        commandsToBuffer([['ECHO', 'a']]),
        commandsToBuffer([['ECHO', 'b']]),
        commandsToBuffer([['ECHO', 'c']]),
      ]);

      connection.reply('+a\r\n+b\r\n+c\r\n');

      assert.deepStrictEqual(await pending, [['a'], ['b'], ['c']]);
    });

    it('rejects without writing when the socket is not connected at flush time', async () => {
      const { connection, requester } = createRequester();

      connection.isConnected = false;

      await assert.rejects(requester.send([['PING']]), {
        name: 'SolidisRequesterError',
        message: 'Socket is not connected.',
      });
      assert.strictEqual(connection.writes.length, 0);
    });

    it('rejects everything with a client error when the client quits', async () => {
      const { connection, requester } = createRequester();

      const pending = requester.send([['PING']]);

      await flushed();

      connection.emit('end');

      await assert.rejects(pending, {
        name: 'SolidisClientError',
        message: 'The client was quit.',
      });
    });

    it('rejects an empty or unsupported command before writing anything', async () => {
      const { connection, requester } = createRequester();

      await assert.rejects(requester.send([['PING'], []]), {
        message: 'Cannot send an empty or non-array command.',
      });
      await assert.rejects(requester.send([['PING'], ['monitor']]), {
        message:
          'MONITOR is not supported: it breaks the pairing of requests and replies.',
      });
      await assert.rejects(requester.send([['Client', 'Reply', 'Off']]), {
        message:
          'CLIENT REPLY is not supported: it breaks the pairing of requests and replies.',
      });

      await flushed();

      assert.strictEqual(connection.writes.length, 0);
    });

    it('refuses an unsupported command whose words end at a NUL byte', async () => {
      const { connection, requester } = createRequester();

      await assert.rejects(requester.send([['CLIENT', 'REPLY', 'SKIP\0']]), {
        message:
          'CLIENT REPLY is not supported: it breaks the pairing of requests and replies.',
      });
      await assert.rejects(requester.send([['client', 'reply\0x', 'off']]), {
        message:
          'CLIENT REPLY\0X is not supported: it breaks the pairing of requests and replies.',
      });

      await flushed();

      assert.strictEqual(connection.writes.length, 0);
    });

    it('reads command names and HELLO options only up to a NUL byte, as the server does', async () => {
      const { connection, pubSub, requester } = createRequester();

      await assert.rejects(requester.send([['MONITOR\0x']]), {
        message:
          'MONITOR\0X is not supported: it breaks the pairing of requests and replies.',
      });
      await assert.rejects(requester.send([['CLIENT\0', 'REPLY', 'SKIP']]), {
        message:
          'CLIENT\0 is not supported: it breaks the pairing of requests and replies.',
      });

      const tracked = requester.send([
        ['SELECT\0', '2'],
        ['HELLO', '3', 'AUTH\0x', 'user', 'secret'],
        ['SUBSCRIBE\0x', 'news'],
        ['MULTI\0'],
      ]);

      await flushed();

      connection.reply(
        `+OK\r\n%1\r\n+proto\r\n:3\r\n${subscribeConfirmation('subscribe', 'news', 1)}+OK\r\n`,
      );

      assert.strictEqual((await tracked).length, 4);
      assert.strictEqual(requester.database, 2);
      assert.strictEqual(requester.protocol, SolidisProtocols.RESP3);
      assert.deepStrictEqual(requester.authentication, {
        username: 'user',
        password: 'secret',
      });
      assert.deepStrictEqual(pubSub.getSubscriptions('subscribe'), [
        Buffer.from('news'),
      ]);
      await assert.rejects(requester.send([['SSUBSCRIBE', 'shard']]), {
        message:
          'SSUBSCRIBE is not supported inside a transaction: it breaks the pairing of requests and replies.',
      });
    });

    it('refuses a send() argument that is not an array', async () => {
      const { connection, requester } = createRequester();

      const broken = [undefined, null, {}, 5, 'PING'].map((value) =>
        settle(requester.send(value as never)),
      );
      const intact = requester.send([['PING']]);

      for (const error of await Promise.all(broken)) {
        assert.ok(error instanceof SolidisRequesterError);
        assert.strictEqual(
          error.message,
          'Cannot send an empty or non-array command.',
        );
      }

      connection.reply('+PONG\r\n');

      assert.deepStrictEqual(await intact, [['PONG']]);
    });

    it('refuses a command that is not an array and sends the rest of the batch', async () => {
      const { connection, requester } = createRequester();
      const shapes: unknown[] = [undefined, null, {}, 42, 'PING'];

      const broken = shapes.map((shape) =>
        settle(requester.send([shape as never])),
      );
      const intact = requester.send([['PING']]);

      for (const error of await Promise.all(broken)) {
        assert.ok(error instanceof SolidisRequesterError);
        assert.strictEqual(
          error.message,
          'Cannot send an empty or non-array command.',
        );
      }

      connection.reply('+PONG\r\n');

      assert.deepStrictEqual(await intact, [['PONG']]);
      assert.strictEqual(connection.writes.length, 1);
    });

    it('refuses the commands of a MULTI lost with the connection until the transaction ends', async () => {
      const { connection, requester } = createRequester({
        rejectOnPartialPipelineError: true,
      });

      async function exchange(
        commands: string[][],
        reply: string,
        options?: SolidisSendOptions,
      ) {
        const pending = requester.send(commands, options);

        await flushed();

        connection.reply(reply);

        return await pending;
      }

      await exchange([['MULTI']], '+OK\r\n');

      connection.emit('close', new SolidisConnectionError('lost'));

      await assert.rejects(requester.send([['INCR', 'counter']]), {
        name: 'SolidisRequesterError',
        message: 'INCR is refused after a lost MULTI.',
      });
      assert.deepStrictEqual(
        await exchange(
          [['CLIENT', 'SETNAME', 'probe']],
          '+OK\r\n',
          SolidisSessionSendOptions,
        ),
        [['OK']],
      );

      const ended = requester.send([['EXEC']]);

      await flushed();

      assert.deepStrictEqual(
        connection.writes.at(-1),
        commandsToBuffer([['DISCARD']]),
      );

      connection.reply('-ERR DISCARD without MULTI\r\n');

      assert.deepStrictEqual(await ended, [[null]]);
      assert.deepStrictEqual(await exchange([['INCR', 'counter']], ':1\r\n'), [
        [1],
      ]);

      await exchange([['MULTI']], '+OK\r\n');

      connection.emit('close', new SolidisConnectionError('lost'));

      assert.deepStrictEqual(
        await exchange(
          [['MULTI'], ['INCR', 'counter'], ['EXEC']],
          '+OK\r\n+QUEUED\r\n*1\r\n:2\r\n',
        ),
        [['OK'], ['QUEUED'], [[2]]],
      );

      await exchange([['MULTI']], '+OK\r\n');

      connection.emit('close', new SolidisConnectionError('lost'));

      await assert.rejects(
        exchange([['DISCARD']], '-ERR DISCARD without MULTI\r\n'),
        { name: 'SolidisCommandError' },
      );
      assert.deepStrictEqual(await exchange([['INCR', 'counter']], ':3\r\n'), [
        [3],
      ]);

      await exchange([['MULTI']], '+OK\r\n');

      connection.emit('close', new SolidisConnectionError('lost'));

      assert.deepStrictEqual(await exchange([['RESET']], '+RESET\r\n'), [
        ['RESET'],
      ]);
      assert.deepStrictEqual(await exchange([['INCR', 'counter']], ':4\r\n'), [
        [4],
      ]);
    });

    it('keeps the transaction and the WATCH when DISCARD fails', async () => {
      const { connection, requester } = createRequester();

      async function exchange(commands: string[][], reply: string) {
        const pending = requester.send(commands);

        await flushed();

        connection.reply(reply);

        return await pending;
      }

      await exchange([['MULTI']], '+OK\r\n');
      await exchange(
        [['DISCARD', 'extra']],
        "-ERR wrong number of arguments for 'discard' command\r\n",
      );
      await assert.rejects(requester.send([['SUBSCRIBE', 'a']]), {
        message:
          'SUBSCRIBE is not supported inside a transaction: it breaks the pairing of requests and replies.',
      });
      await exchange([['DISCARD']], '+OK\r\n');
      await exchange([['WATCH', 'k']], '+OK\r\n');
      await exchange([['DISCARD']], '-ERR DISCARD without MULTI\r\n');

      connection.emit('close', new SolidisConnectionError('lost'));
      connection.isConnected = true;

      const ended = requester.send([['MULTI'], ['SET', 'k', 'v'], ['EXEC']]);

      await flushed();

      assert.deepStrictEqual(
        connection.writes.at(-1),
        commandsToBuffer([['MULTI'], ['SET', 'k', 'v'], ['DISCARD']]),
      );

      connection.reply('+OK\r\n+QUEUED\r\n+OK\r\n');

      assert.deepStrictEqual(await ended, [['OK'], ['QUEUED'], [null]]);

      await exchange([['WATCH', 'k']], '+OK\r\n');
      await exchange([['MULTI']], '+OK\r\n');
      await exchange(
        [['EXEC']],
        '-EXECABORT Transaction discarded because of previous errors.\r\n',
      );

      connection.emit('close', new SolidisConnectionError('lost'));
      connection.isConnected = true;

      assert.deepStrictEqual(await exchange([['EXEC']], '*0\r\n'), [[[]]]);
    });

    it('rejects a batch that cannot be serialized and resets the connection', async () => {
      const { connection, requester } = createRequester();
      const failure = new RangeError('Array buffer allocation failed');
      const poisoned = Buffer.from('v');

      Object.defineProperty(poisoned, 'copy', {
        value: () => {
          throw failure;
        },
      });

      const sent = settle(requester.send([['GET', 'a']]));
      const unsendable = settle(requester.send([['SET', 'k', poisoned]]));
      const later = settle(requester.send([['GET', 'b']], { timeout: 99 }));

      await flushed();

      const errors = await Promise.all([sent, unsendable, later]);

      for (const error of errors) {
        assert.ok(error instanceof SolidisRequesterError);
        assert.strictEqual(error.message, 'Array buffer allocation failed');
        assert.strictEqual(error.cause, failure);
      }

      assert.deepStrictEqual(connection.resets, [errors[1]]);
    });

    it('keeps the session state of a batch it could not serialize', async () => {
      const { connection, requester } = createRequester({
        maxCommandsPerPipeline: 1,
      });
      const failure = new RangeError('Array buffer allocation failed');
      const poisoned = Buffer.from('v');

      Object.defineProperty(poisoned, 'copy', {
        value: () => {
          throw failure;
        },
      });

      const watch = requester.send([['WATCH', 'k']]);

      await flushed();
      connection.reply('+OK\r\n');
      await watch;
      connection.emit('close', new SolidisConnectionError('lost'));
      connection.isConnected = true;

      const transaction = settle(
        requester.send([['MULTI'], ['SET', 'k', poisoned], ['EXEC']], {
          timeout: 50,
        }),
      );

      await flushed();

      assert.ok((await transaction) instanceof SolidisRequesterError);

      connection.isConnected = true;

      const read = requester.send([['GET', 'k']]);

      await flushed();

      assert.deepStrictEqual(
        connection.writes.at(-1),
        commandsToBuffer([['GET', 'k']]),
      );

      await new Promise((resolve) => setTimeout(resolve, 80));

      assert.strictEqual(connection.resets.length, 1);

      connection.reply('$-1\r\n');

      assert.deepStrictEqual(await read, [[null]]);

      requester.send([['MULTI'], ['SET', 'k', 'v'], ['EXEC']]).catch(() => {});

      await flushed();

      assert.deepStrictEqual(
        connection.writes.at(-1),
        commandsToBuffer([['DISCARD']]),
      );
    });

    it('forgets a refused MULTI or WATCH while another session command is in flight', async () => {
      const { connection, requester } = createRequester();
      const multi = requester.send([['MULTI']]);
      const select = settle(requester.send([['SELECT', '1']]));

      await flushed();

      connection.reply(
        "-NOPERM User has no permissions to run the 'multi' command\r\n",
      );

      assert.ok((await multi)[0][0] instanceof RespError);

      const subscription = settle(requester.send([['SUBSCRIBE', 'news']]));

      await flushed();

      assert.deepStrictEqual(
        connection.writes.at(-1),
        commandsToBuffer([['SUBSCRIBE', 'news']]),
      );

      connection.emit('close', new SolidisConnectionError('lost'));

      assert.ok((await select) instanceof SolidisConnectionError);
      assert.ok((await subscription) instanceof SolidisConnectionError);

      const read = requester.send([['GET', 'k']]);

      await flushed();

      connection.reply('$-1\r\n');

      assert.deepStrictEqual(await read, [[null]]);

      const watch = requester.send([['WATCH', 'other']]);
      const selected = settle(requester.send([['SELECT', '2']]));

      await flushed();

      connection.reply('-NOPERM No permissions to access a key\r\n');

      assert.ok((await watch)[0][0] instanceof RespError);

      connection.emit('close', new SolidisConnectionError('lost'));

      assert.ok((await selected) instanceof SolidisConnectionError);

      const transaction = requester.send([
        ['MULTI'],
        ['INCR', 'counter'],
        ['EXEC'],
      ]);

      await flushed();

      connection.reply('+OK\r\n+QUEUED\r\n*1\r\n:1\r\n');

      assert.deepStrictEqual(await transaction, [['OK'], ['QUEUED'], [[1]]]);
      assert.deepStrictEqual(
        connection.writes.at(-1),
        commandsToBuffer([['MULTI'], ['INCR', 'counter'], ['EXEC']]),
      );
    });

    it('counts an unanswered UNWATCH when a connection with a WATCH is lost', async () => {
      const { connection, requester } = createRequester();
      const watch = requester.send([['WATCH', 'k']]);

      await flushed();

      connection.reply('+OK\r\n');

      assert.deepStrictEqual(await watch, [['OK']]);

      const unwatch = settle(requester.send([['UNWATCH']]));

      await flushed();

      connection.emit('close', new SolidisConnectionError('lost'));

      assert.ok((await unwatch) instanceof SolidisConnectionError);

      const transaction = requester.send([
        ['MULTI'],
        ['INCR', 'counter'],
        ['EXEC'],
      ]);

      await flushed();

      connection.reply('+OK\r\n+QUEUED\r\n*1\r\n:1\r\n');

      assert.deepStrictEqual(await transaction, [['OK'], ['QUEUED'], [[1]]]);
      assert.deepStrictEqual(
        connection.writes.at(-1),
        commandsToBuffer([['MULTI'], ['INCR', 'counter'], ['EXEC']]),
      );
    });

    it('refuses every command but MULTI, EXEC, DISCARD and RESET after a lost MULTI', async () => {
      const { connection, requester } = createRequester();
      const multi = settle(requester.send([['MULTI']]));

      await flushed();

      connection.emit('close', new SolidisConnectionError('lost'));

      assert.ok((await multi) instanceof SolidisConnectionError);

      for (const [command, name] of [
        [['GET', 'k'], 'GET'],
        [['WATCH', 'k'], 'WATCH'],
        [['UNWATCH'], 'UNWATCH'],
        [['SELECT', '1'], 'SELECT'],
        [['HELLO', '3'], 'HELLO'],
        [['AUTH', 'secret'], 'AUTH'],
        [['SUBSCRIBE', 'news'], 'SUBSCRIBE'],
        [['CLIENT', 'ID'], 'CLIENT ID'],
      ] as const) {
        await assert.rejects(requester.send([[...command]]), {
          name: 'SolidisRequesterError',
          message: `${name} is refused after a lost MULTI.`,
        });
      }

      const reset = requester.send([['RESET'], ['GET', 'k']]);

      await flushed();

      assert.deepStrictEqual(
        connection.writes.at(-1),
        commandsToBuffer([['RESET'], ['GET', 'k']]),
      );

      connection.reply('+RESET\r\n$-1\r\n');

      assert.deepStrictEqual(await reset, [['RESET'], [null]]);
    });

    it('resolves error replies of handshake requests even with rejectOnPartialPipelineError', async () => {
      const { connection, requester } = createRequester({
        rejectOnPartialPipelineError: true,
      });
      const session = requester.send(
        [['SUBSCRIBE', 'news']],
        SolidisSessionSendOptions,
      );
      const command = settle(requester.send([['GET', 'k']]));

      await flushed();

      connection.reply('-NOPERM no access\r\n-WRONGTYPE wrong kind\r\n');

      const [[refusal]] = await session;

      assert.ok(refusal instanceof RespError);
      assert.strictEqual(refusal.code, 'NOPERM');
      assert.ok((await command) instanceof SolidisCommandError);
    });

    it('counts an unanswered MULTI as lost and an unanswered EXEC as the end of its transaction', async () => {
      const { connection, requester } = createRequester();
      const multi = settle(requester.send([['MULTI']]));

      await flushed();

      connection.emit('close', new SolidisConnectionError('lost'));

      assert.ok((await multi) instanceof SolidisConnectionError);
      await assert.rejects(requester.send([['GET', 'k']]), {
        name: 'SolidisRequesterError',
        message: 'GET is refused after a lost MULTI.',
      });

      const discard = requester.send([['DISCARD']]);

      await flushed();

      connection.reply('-ERR DISCARD without MULTI\r\n');

      assert.ok((await discard)[0][0] instanceof RespError);

      const transaction = settle(
        requester.send([['MULTI'], ['INCR', 'counter'], ['EXEC']]),
      );

      await flushed();

      connection.reply('+OK\r\n+QUEUED\r\n');
      connection.emit('close', new SolidisConnectionError('lost'));

      assert.ok((await transaction) instanceof SolidisConnectionError);

      const read = requester.send([['GET', 'k']]);

      await flushed();

      connection.reply('$-1\r\n');

      assert.deepStrictEqual(await read, [[null]]);
    });

    it('writes one command per pipeline when maxCommandsPerPipeline is below 1', async () => {
      for (const maxCommandsPerPipeline of [0, -1]) {
        const { connection, requester } = createRequester({
          maxCommandsPerPipeline,
        });
        const replies = requester.send([['PING'], ['ECHO', 'a']]);

        await flushed();

        assert.deepStrictEqual(connection.writes, [
          commandsToBuffer([['PING']]),
          commandsToBuffer([['ECHO', 'a']]),
        ]);

        connection.reply('+PONG\r\n$1\r\na\r\n');

        assert.deepStrictEqual(await replies, [['PONG'], [Buffer.from('a')]]);
      }
    });

    it('writes each blocking request in a pipeline of its own when the timeouts match', async () => {
      const { connection, requester } = createRequester({ commandTimeout: 0 });
      const first = requester.send([['BLPOP', 'a', '0']], {
        blockingTimeout: 0,
      });
      const second = requester.send([['BLPOP', 'b', '0']], {
        blockingTimeout: 0,
      });
      const echo = requester.send([['ECHO', 'x']]);

      await flushed();

      assert.deepStrictEqual(connection.writes, [
        commandsToBuffer([['BLPOP', 'a', '0']]),
        commandsToBuffer([['BLPOP', 'b', '0']]),
        commandsToBuffer([['ECHO', 'x']]),
      ]);

      connection.reply('*-1\r\n*-1\r\n$1\r\nx\r\n');

      assert.deepStrictEqual(await Promise.all([first, second, echo]), [
        [[null]],
        [[null]],
        [[Buffer.from('x')]],
      ]);
    });

    it('reports an error after the replies it could answer as a stray reply', async () => {
      const { connection, events, requester } = createRequester();
      const ping = requester.send([['PING']]);

      await flushed();

      const write = requester.send([['SET', 'k', 'v']]);

      connection.reply('+PONG\r\n-ERR proxy notice\r\n');

      assert.deepStrictEqual(await ping, [['PONG']]);

      await flushed();

      connection.reply('+OK\r\n');

      assert.deepStrictEqual(await write, [['OK']]);
      assert.ok(
        events.some(
          ([event, error]) =>
            event === 'error' &&
            error instanceof SolidisRequesterError &&
            error.message === 'Received reply with no pending request',
        ),
      );
    });

    it('forgets a MULTI or WATCH that the server refuses', async () => {
      function exchange(
        requester: SolidisRequester,
        connection: { reply: (data: string) => void },
        commands: string[][],
        reply: string,
      ) {
        const pending = requester.send(commands);

        return flushed().then(() => {
          connection.reply(reply);

          return pending;
        });
      }

      const refused = createRequester();

      await exchange(
        refused.requester,
        refused.connection,
        [['MULTI']],
        "-NOPERM User has no permissions to run the 'multi' command\r\n",
      );

      const subscription = settle(
        refused.requester.send([['SUBSCRIBE', 'news']]),
      );

      await flushed();

      assert.deepStrictEqual(
        refused.connection.writes.at(-1),
        commandsToBuffer([['SUBSCRIBE', 'news']]),
      );

      refused.connection.emit('close', new SolidisConnectionError('lost'));

      assert.ok((await subscription) instanceof SolidisConnectionError);
      assert.deepStrictEqual(
        await exchange(
          refused.requester,
          refused.connection,
          [['GET', 'k']],
          '$-1\r\n',
        ),
        [[null]],
      );

      await exchange(
        refused.requester,
        refused.connection,
        [['WATCH', 'other']],
        '-NOPERM No permissions to access a key\r\n',
      );

      refused.connection.emit('close', new SolidisConnectionError('lost'));

      assert.deepStrictEqual(
        await exchange(
          refused.requester,
          refused.connection,
          [['MULTI'], ['INCR', 'counter'], ['EXEC']],
          '+OK\r\n+QUEUED\r\n*1\r\n:1\r\n',
        ),
        [['OK'], ['QUEUED'], [[1]]],
      );

      const nested = createRequester();

      await exchange(
        nested.requester,
        nested.connection,
        [['MULTI']],
        '+OK\r\n',
      );
      await exchange(
        nested.requester,
        nested.connection,
        [['MULTI']],
        '-ERR MULTI calls can not be nested\r\n',
      );
      await assert.rejects(nested.requester.send([['SUBSCRIBE', 'news']]), {
        message:
          'SUBSCRIBE is not supported inside a transaction: it breaks the pairing of requests and replies.',
      });

      nested.connection.emit('close', new SolidisConnectionError('lost'));

      await assert.rejects(nested.requester.send([['GET', 'k']]), {
        message: 'GET is refused after a lost MULTI.',
      });

      const pipelined = createRequester();

      await exchange(
        pipelined.requester,
        pipelined.connection,
        [
          ['WATCH', 'other'],
          ['WATCH', 'mine'],
        ],
        '-NOPERM No permissions to access a key\r\n+OK\r\n',
      );

      pipelined.connection.emit('close', new SolidisConnectionError('lost'));

      const aborted = pipelined.requester.send([
        ['MULTI'],
        ['INCR', 'counter'],
        ['EXEC'],
      ]);

      await flushed();

      assert.deepStrictEqual(
        pipelined.connection.writes.at(-1),
        commandsToBuffer([['MULTI'], ['INCR', 'counter'], ['DISCARD']]),
      );

      pipelined.connection.reply('+OK\r\n+QUEUED\r\n+OK\r\n');

      assert.deepStrictEqual(await aborted, [['OK'], ['QUEUED'], [null]]);
    });

    it('drops a silent connection under traffic with timeouts shorter than commandTimeout', async () => {
      const { connection, requester } = createRequester({
        commandTimeout: 300,
      });
      const greeting = requester.send([['PING']]);

      await flushed();

      connection.reply('+PONG\r\n');

      assert.deepStrictEqual(await greeting, [['PONG']]);

      const pending: Promise<unknown>[] = [];
      const startedAt = performance.now();

      for (
        let round = 0;
        round < 60 && connection.resets.length === 0;
        round += 1
      ) {
        pending.push(settle(requester.send([['PING']], { timeout: 100 })));

        await delay(20);
      }

      assert.ok(performance.now() - startedAt >= 300);
      assert.ok(pending.length < 60);
      assert.strictEqual(connection.resets.length, 1);

      await Promise.all(pending);

      assert.strictEqual(
        connection.resets[0].message,
        'Connection reset because a command timed out.',
      );
    });

    it('refuses a command whose name cannot become text without stranding its batch', async () => {
      const { connection, requester } = createRequester();
      const nameless = Object.create(null) as string;
      const refused = [
        settle(requester.send([[nameless, 'k']])),
        settle(requester.send([['CLIENT', nameless]])),
      ];
      const valid = requester.send([['PING']]);
      const [unnamed, unknownSubcommand] = await Promise.all(refused);

      assert.ok(unnamed instanceof SolidisRequesterError);
      assert.strictEqual(unnamed.message, '? takes only strings and Buffers.');
      assert.ok(unknownSubcommand instanceof SolidisRequesterError);
      assert.strictEqual(
        unknownSubcommand.message,
        'CLIENT ? takes only strings and Buffers.',
      );

      await flushed();

      connection.reply('+PONG\r\n');

      assert.deepStrictEqual(await valid, [['PONG']]);
    });

    it('reads only the first bytes of each word to classify a command', async () => {
      const { connection, requester } = createRequester();
      const guarded = Buffer.from('payload');

      Object.defineProperty(guarded, 'toString', {
        value: (encoding?: BufferEncoding, start?: number, end?: number) => {
          assert.notStrictEqual(end, undefined, 'a whole Buffer was decoded');

          return Buffer.prototype.toString.call(guarded, encoding, start, end);
        },
      });

      const loaded = requester.send([
        ['SCRIPT', 'LOAD', guarded],
        [guarded, 'x'],
      ]);

      await flushed();

      assert.strictEqual(connection.writes.length, 1);

      connection.reply('$3\r\nsha\r\n-ERR unknown command\r\n');

      const [script, unknown] = await loaded;

      assert.deepStrictEqual(script, [Buffer.from('sha')]);
      assert.ok(unknown[0] instanceof RespError);
    });

    it('rejects pending requests with an error the server sends before any request reaches it', async () => {
      const { connection, requester } = createRequester();

      const named = settle(requester.send([['CLIENT', 'SETNAME', 'app']]));
      const read = settle(requester.send([['GET', 'k']]));

      connection.reply('-ERR max number of clients reached\r\n');

      for (const error of await Promise.all([named, read])) {
        assert.ok(error instanceof SolidisConnectionError);
        assert.strictEqual(error.message, 'ERR max number of clients reached');
        assert.ok(error.cause instanceof RespError);
        assert.strictEqual(error.cause.message, error.message);
      }

      await flushed();

      assert.deepStrictEqual(connection.writes, []);
    });

    it('never resets a connection for stalls when commandTimeout is 0', async () => {
      const { connection, requester } = createRequester({ commandTimeout: 0 });

      const quick = [
        settle(requester.send([['ECHO', 'a']], { timeout: 20 })),
        settle(requester.send([['ECHO', 'b']], { timeout: 40 })),
      ];
      const patient = requester.send([['GET', 'slow']]);

      for (const error of await Promise.all(quick)) {
        assert.ok(error instanceof SolidisRequesterError);
      }

      assert.deepStrictEqual(connection.resets, []);

      connection.reply('+a\r\n+b\r\n$4\r\nslow\r\n');

      assert.deepStrictEqual(await patient, [[Buffer.from('slow')]]);
    });

    it('remembers a lost WATCH and a lost MULTI across several drops', async () => {
      const { connection, requester } = createRequester();

      async function exchange(commands: string[][], reply: string) {
        const pending = requester.send(commands);

        await flushed();

        connection.reply(reply);

        return await pending;
      }

      function drop() {
        connection.emit('close', new SolidisConnectionError('lost'));
      }

      await exchange([['WATCH', 'k']], '+OK\r\n');

      drop();
      drop();

      const aborted = requester.send([
        ['MULTI'],
        ['INCR', 'counter'],
        ['EXEC'],
      ]);

      await flushed();

      assert.deepStrictEqual(
        connection.writes.at(-1),
        commandsToBuffer([['MULTI'], ['INCR', 'counter'], ['DISCARD']]),
      );

      connection.reply('+OK\r\n+QUEUED\r\n+OK\r\n');

      assert.deepStrictEqual(await aborted, [['OK'], ['QUEUED'], [null]]);

      await exchange([['MULTI']], '+OK\r\n');

      drop();
      drop();

      await assert.rejects(requester.send([['GET', 'k']]), {
        message: 'GET is refused after a lost MULTI.',
      });
    });

    it('classifies a command whose name is a Buffer', async () => {
      const { connection, requester } = createRequester();

      await assert.rejects(requester.send([[Buffer.from('MONITOR')]]), {
        message:
          'MONITOR is not supported: it breaks the pairing of requests and replies.',
      });

      const selected = requester.send([[Buffer.from('select'), '3']]);

      await flushed();

      connection.reply('+OK\r\n');

      await selected;

      assert.strictEqual(requester.database, 3);
    });

    it('copies the commands at send(), so later changes to the arrays are not sent', async () => {
      const { connection, requester } = createRequester();

      const reused: unknown[] = ['SET', 'a', '1'];
      const batch = [
        ['SELECT', '2'],
        ['GET', 'a'],
      ];
      const first = requester.send([reused as string[]]);

      reused[2] = undefined;

      const second = requester.send(batch);

      batch[0][1] = '7';
      batch.length = 0;
      reused.splice(0, 3, 'SUBSCRIBE', 'news');

      await flushed();

      assert.deepStrictEqual(connection.writes, [
        commandsToBuffer([
          ['SET', 'a', '1'],
          ['SELECT', '2'],
          ['GET', 'a'],
        ]),
      ]);

      connection.reply('+OK\r\n+OK\r\n$1\r\n1\r\n');

      assert.deepStrictEqual(await first, [['OK']]);
      assert.deepStrictEqual(await second, [['OK'], [Buffer.from('1')]]);
      assert.strictEqual(requester.database, 2);
    });

    it('sends an argument-less UNSUBSCRIBE as is and reads its replies however many channels it ends', async () => {
      const { connection, pubSub, requester } = createRequester();
      const channels = Array.from(
        { length: 150_000 },
        (_, index) => `c${index}`,
      );
      const subscribing = requester.send([['SUBSCRIBE', ...channels]]);
      const unsubscribing = requester.send([['UNSUBSCRIBE']]);

      await flushed();

      assert.strictEqual(connection.writes.length, 1);
      assert.ok(
        connection.writes[0].equals(
          commandsToBuffer([['SUBSCRIBE', ...channels], ['UNSUBSCRIBE']]),
        ),
      );

      connection.reply(
        channels
          .map((channel, index) =>
            subscribeConfirmation('subscribe', channel, index + 1),
          )
          .join(''),
      );
      connection.reply(
        channels
          .map((channel, index) =>
            subscribeConfirmation(
              'unsubscribe',
              channel,
              channels.length - index - 1,
            ),
          )
          .join(''),
      );

      assert.strictEqual((await subscribing)[0].length, channels.length);
      assert.strictEqual((await unsubscribing)[0].length, channels.length);
      assert.strictEqual(pubSub.hasActiveSubscriptions, false);
    });

    it('ends a binary channel with an argument-less UNSUBSCRIBE', async () => {
      const { connection, pubSub, requester } = createRequester();
      const channel = Buffer.from([0x63, 0xff, 0xfe]);

      pubSub.dispatchSubscriptionChange('subscribe', ['subscribe', channel, 1]);

      const pending = requester.send([['UNSUBSCRIBE']]);

      await flushed();

      assert.deepStrictEqual(connection.writes, [
        commandsToBuffer([['UNSUBSCRIBE']]),
      ]);

      connection.emit(
        'data',
        Buffer.concat([
          Buffer.from('*3\r\n$11\r\nunsubscribe\r\n$3\r\n'),
          channel,
          Buffer.from('\r\n:0\r\n'),
        ]),
      );

      const [[confirmation]] = await pending;

      assert.ok(Array.isArray(confirmation));
      assert.deepStrictEqual(confirmation[1], channel);
      assert.deepStrictEqual(pubSub.getSubscriptions('subscribe'), []);
    });

    it('stops routing a chunk once a listener ends the session', async () => {
      const { connection, events, requester } = createRequester({}, (event) => {
        if (event === 'subscribe') {
          connection.emit('end');
        }
      });
      const pending = settle(requester.send([['SUBSCRIBE', 'a', 'b']]));

      await flushed();

      connection.reply(
        `${subscribeConfirmation('subscribe', 'a', 1)}${subscribeConfirmation('subscribe', 'b', 2)}`,
      );

      const error = await pending;

      assert.ok(error instanceof SolidisClientError);
      assert.strictEqual(getEvents(events, 'subscribe').length, 1);
      assert.deepStrictEqual(getEvents(events, 'error'), []);
    });

    it('tracks binary credentials byte for byte', async () => {
      const { connection, requester } = createRequester();
      const username = Buffer.from([0xc3, 0x28]);
      const password = Buffer.from([0xff, 0x00, 0xfe]);

      const authenticated = requester.send([['AUTH', username, password]]);

      await flushed();

      connection.reply('+OK\r\n');

      await authenticated;

      assert.deepStrictEqual(requester.authentication, { username, password });

      const greeted = requester.send([
        ['HELLO', '2', 'AUTH', password, username],
      ]);

      await flushed();

      connection.reply('*2\r\n+proto\r\n:2\r\n');

      await greeted;

      assert.deepStrictEqual(requester.authentication, {
        username: password,
        password: username,
      });
    });

    it('keeps replies aligned after a request times out while a later one is pending', async () => {
      const { connection, requester } = createRequester({
        commandTimeout: 200,
      });

      const early = settle(requester.send([['ECHO', 'early']]));

      await delay(100);

      const late = requester.send([['ECHO', 'late']]);
      const error = await early;

      assert.ok(error instanceof SolidisRequesterError);
      assert.strictEqual(error.message, 'Command(s) timed out after 200 ms.');
      assert.strictEqual(connection.resets.length, 0);

      connection.reply('+early\r\n+late\r\n');

      assert.deepStrictEqual(await late, [['late']]);
    });

    it('resets the connection once every in-flight pipeline has timed out', async () => {
      const { connection, requester } = createRequester({ commandTimeout: 30 });

      await assert.rejects(requester.send([['ECHO', 'x']]), {
        name: 'SolidisRequesterError',
        message: 'Command(s) timed out after 30 ms.',
      });

      const [reset] = connection.resets;

      assert.strictEqual(connection.resets.length, 1);
      assert.ok(reset instanceof SolidisRequesterError);
      assert.strictEqual(
        reset.message,
        'Connection reset because a command timed out.',
      );
      assert.ok(reset.cause instanceof SolidisRequesterError);

      connection.isConnected = true;

      const patient = requester.send([['ECHO', 'y']], { timeout: 2000 });
      const quick = settle(requester.send([['ECHO', 'z']]));

      assert.ok((await quick) instanceof SolidisRequesterError);
      assert.strictEqual(connection.resets.length, 1);

      connection.reply('+y\r\n+z\r\n');

      assert.deepStrictEqual(await patient, [['y']]);
    });

    it('resets a connection that stays silent through two timeouts while requests keep coming', async () => {
      const { connection, requester } = createRequester({
        commandTimeout: 100,
      });
      const greeting = requester.send([['PING']]);

      await flushed();

      connection.reply('+PONG\r\n');

      assert.deepStrictEqual(await greeting, [['PONG']]);

      const first = settle(requester.send([['ECHO', 'a']]));

      await delay(40);

      const second = settle(requester.send([['ECHO', 'b']]));

      assert.ok((await first) instanceof SolidisRequesterError);
      assert.strictEqual(connection.resets.length, 0);

      const third = settle(requester.send([['ECHO', 'c']]));
      const error = await second;

      assert.ok(error instanceof SolidisRequesterError);
      assert.strictEqual(error.message, 'Command(s) timed out after 100 ms.');

      const [reset] = connection.resets;

      assert.strictEqual(connection.resets.length, 1);
      assert.ok(reset instanceof SolidisRequesterError);
      assert.strictEqual(
        reset.message,
        'Connection reset because a command timed out.',
      );
      assert.strictEqual(reset.cause, error);
      assert.strictEqual(await third, reset);
    });

    it('keeps a connection that delivered data after a timed-out request was sent', async () => {
      const { connection, requester } = createRequester({
        commandTimeout: 100,
      });

      const first = settle(requester.send([['ECHO', 'a']]));

      await delay(40);

      const second = settle(requester.send([['ECHO', 'b']]));

      await flushed();

      connection.reply('$1\r\n');

      assert.ok((await first) instanceof SolidisRequesterError);

      const third = requester.send([['ECHO', 'c']]);

      assert.ok((await second) instanceof SolidisRequesterError);
      assert.strictEqual(connection.resets.length, 0);

      connection.reply('a\r\n+b\r\n+c\r\n');

      assert.deepStrictEqual(await third, [['c']]);
    });

    it('keeps the connection while an earlier request with a longer timeout still waits', async () => {
      const { connection, requester } = createRequester({
        commandTimeout: 100,
      });

      const first = settle(requester.send([['ECHO', 'a']]));
      const patient = requester.send([['ECHO', 'b']], { timeout: 2000 });
      const third = settle(requester.send([['ECHO', 'c']]));

      assert.ok((await first) instanceof SolidisRequesterError);

      const error = await third;

      assert.ok(error instanceof SolidisRequesterError);
      assert.strictEqual(error.message, 'Command(s) timed out after 100 ms.');
      assert.strictEqual(connection.resets.length, 0);

      connection.reply('+a\r\n+b\r\n+c\r\n');

      assert.deepStrictEqual(await patient, [['b']]);
    });

    it('keeps the connection after a timed-out pipeline ahead of a longer one completes late', async () => {
      const { connection, requester } = createRequester({
        commandTimeout: 100,
      });

      const first = settle(requester.send([['ECHO', 'a']], { timeout: 20 }));
      const patient = requester.send([['ECHO', 'b']], { timeout: 60_000 });
      const third = settle(requester.send([['ECHO', 'c']], { timeout: 40 }));

      assert.ok((await first) instanceof SolidisRequesterError);
      assert.ok((await third) instanceof SolidisRequesterError);

      connection.reply('+a\r\n');

      const fourth = settle(requester.send([['ECHO', 'd']], { timeout: 150 }));

      assert.ok((await fourth) instanceof SolidisRequesterError);
      assert.strictEqual(connection.resets.length, 0);

      connection.reply('+b\r\n+c\r\n+d\r\n');

      assert.deepStrictEqual(await patient, [['b']]);
    });

    it('counts timed-out pipelines afresh after the connection is lost', async () => {
      const { connection, requester } = createRequester({
        commandTimeout: 30,
      });

      const first = settle(requester.send([['ECHO', 'a']], { timeout: 20 }));
      const second = settle(requester.send([['ECHO', 'b']], { timeout: 40 }));

      assert.ok((await first) instanceof SolidisRequesterError);
      assert.ok((await second) instanceof SolidisRequesterError);
      assert.strictEqual(connection.resets.length, 1);

      connection.isConnected = true;

      const patient = requester.send([['ECHO', 'c']], { timeout: 60_000 });
      const quick = settle(requester.send([['ECHO', 'd']], { timeout: 50 }));

      assert.ok((await quick) instanceof SolidisRequesterError);
      assert.strictEqual(connection.resets.length, 1);

      connection.reply('+c\r\n+d\r\n');

      assert.deepStrictEqual(await patient, [['c']]);
    });

    it('resets once the pipelines left in flight have timed out, after an earlier one completed late', async () => {
      const { connection, requester } = createRequester({
        commandTimeout: 100,
      });

      const first = settle(requester.send([['ECHO', 'a']], { timeout: 30 }));
      const second = settle(requester.send([['ECHO', 'b']]));

      assert.ok((await first) instanceof SolidisRequesterError);
      assert.strictEqual(connection.resets.length, 0);

      connection.reply('+a\r\n');

      const error = await second;

      assert.ok(error instanceof SolidisRequesterError);
      assert.strictEqual(error.message, 'Command(s) timed out after 100 ms.');
      assert.strictEqual(connection.resets.length, 1);
    });

    it('keeps the connection while short timeouts expire before the oldest request has waited commandTimeout', async () => {
      const { connection, requester } = createRequester({
        commandTimeout: 200,
      });

      const first = settle(requester.send([['ECHO', 'a']], { timeout: 50 }));

      await delay(10);

      const quick = settle(requester.send([['ECHO', 'b']], { timeout: 50 }));
      const trailing = requester.send([['ECHO', 'c']]);

      assert.ok((await first) instanceof SolidisRequesterError);
      assert.ok((await quick) instanceof SolidisRequesterError);
      assert.strictEqual(connection.resets.length, 0);

      connection.reply('+a\r\n+b\r\n+c\r\n');

      assert.deepStrictEqual(await trailing, [['c']]);
    });

    it('drains a hundred thousand in-flight pipelines in linear time', async () => {
      const { connection, requester } = createRequester({
        commandTimeout: 0,
        maxCommandsPerPipeline: 1,
      });
      const count = 100_000;
      const pending = requester.send(
        Array.from({ length: count }, () => ['PING']),
      );

      await flushed();

      assert.strictEqual(connection.writes.length, count);

      const startedAt = performance.now();

      connection.reply('+PONG\r\n'.repeat(count));

      assert.strictEqual((await pending).length, count);
      assert.ok(performance.now() - startedAt < 2000);
    });

    it('times out fifty thousand in-flight pipelines in linear time', async () => {
      const { connection, requester } = createRequester({
        commandTimeout: 60_000,
        maxCommandsPerPipeline: 1,
      });
      const count = 50_000;
      const startedAt = performance.now();
      const pending = settle(
        requester.send(
          Array.from({ length: count }, (_, index) => ['ECHO', `${index}`]),
          { timeout: 50 },
        ),
      );

      assert.ok((await pending) instanceof SolidisRequesterError);

      await waitFor(() => connection.resets.length > 0, { timeout: 4000 });

      assert.ok(performance.now() - startedAt < 2000);
      assert.strictEqual(connection.resets.length, 1);
    });

    it('gives a blocking request its own pipeline with an extended deadline', async () => {
      const { connection, requester } = createRequester({
        commandTimeout: 100,
      });

      let isBlockingSettled = false;

      const leading = requester.send([['ECHO', 'a']]);
      const blocking = settle(
        requester.send([['BLPOP', 'k', '0.2']], { blockingTimeout: 200 }),
      ).finally(() => {
        isBlockingSettled = true;
      });
      const trailing = requester.send([['ECHO', 'b']]);

      await flushed();

      assert.deepStrictEqual(connection.writes, [
        commandsToBuffer([['ECHO', 'a']]),
        commandsToBuffer([['BLPOP', 'k', '0.2']]),
        commandsToBuffer([['ECHO', 'b']]),
      ]);

      connection.reply('+a\r\n');

      assert.deepStrictEqual(await leading, [['a']]);

      await assert.rejects(trailing, {
        message: 'Command(s) timed out after 100 ms.',
      });

      assert.strictEqual(isBlockingSettled, false);
      assert.strictEqual(connection.resets.length, 0);

      const error = await blocking;

      assert.ok(error instanceof SolidisRequesterError);
      assert.strictEqual(error.message, 'Command(s) timed out after 300 ms.');
      assert.strictEqual(connection.resets.length, 1);
    });

    it('times out pipelines behind one with a longer timeout in linear time', async () => {
      const { connection, requester } = createRequester({
        commandTimeout: 100,
        maxCommandsPerPipeline: 1,
      });
      const count = 50_000;
      const commands = Array.from({ length: count }, (_, index) => [
        'ECHO',
        `${index}`,
      ]);
      const early = settle(requester.send(commands, { timeout: 300 }));

      await flushed();

      connection.reply('>2\r\n+push\r\n+between\r\n');

      const patient = settle(
        requester.send([['ECHO', 'patient']], { timeout: 60_000 }),
      );
      const late = Promise.all(
        commands.map((command) =>
          settle(requester.send([command], { timeout: 600 })),
        ),
      );

      assert.ok((await early) instanceof SolidisRequesterError);

      const startedAt = performance.now();

      for (const error of await late) {
        assert.ok(error instanceof SolidisRequesterError);
      }

      assert.ok(performance.now() - startedAt < 2000);
      assert.strictEqual(connection.resets.length, 0);

      connection.emit('close', new SolidisConnectionError('lost'));

      assert.ok((await patient) instanceof SolidisConnectionError);
    });

    it('never times out a blocking request with a zero blocking timeout', async () => {
      const { connection, requester } = createRequester({ commandTimeout: 20 });

      const blocking = requester.send([['BLPOP', 'k', '0']], {
        blockingTimeout: 0,
      });

      await delay(80);

      connection.reply('*2\r\n$1\r\nk\r\n$1\r\nv\r\n');

      assert.deepStrictEqual(await blocking, [
        [[Buffer.from('k'), Buffer.from('v')]],
      ]);
      assert.strictEqual(connection.resets.length, 0);
    });

    it('never times out when commandTimeout is disabled', async () => {
      const { connection, requester } = createRequester({ commandTimeout: 0 });

      const pending = requester.send([['PING']]);
      const blocking = requester.send([['BLPOP', 'k', '0.01']], {
        blockingTimeout: 10,
      });

      await delay(40);

      connection.reply('+PONG\r\n*-1\r\n');

      assert.deepStrictEqual(await pending, [['PONG']]);
      assert.deepStrictEqual(await blocking, [[null]]);
      assert.strictEqual(connection.resets.length, 0);
    });

    it('times a request out after its own timeout in a pipeline of its own', async () => {
      const { connection, requester } = createRequester({
        commandTimeout: 1000,
      });

      const leading = requester.send([['ECHO', 'a']]);
      const quick = settle(requester.send([['ECHO', 'b']], { timeout: 30 }));
      const trailing = requester.send([['ECHO', 'c']]);
      const startedAt = Date.now();

      await flushed();

      assert.deepStrictEqual(connection.writes, [
        commandsToBuffer([['ECHO', 'a']]),
        commandsToBuffer([['ECHO', 'b']]),
        commandsToBuffer([['ECHO', 'c']]),
      ]);

      const error = await quick;

      assert.ok(error instanceof SolidisRequesterError);
      assert.strictEqual(error.message, 'Command(s) timed out after 30 ms.');
      assert.ok(Date.now() - startedAt < 500);
      assert.strictEqual(connection.resets.length, 0);

      connection.reply('+a\r\n+b\r\n+c\r\n');

      assert.deepStrictEqual(await leading, [['a']]);
      assert.deepStrictEqual(await trailing, [['c']]);
    });

    it('keeps consecutive requests with the same timeout in one pipeline', async () => {
      const { connection, requester } = createRequester({
        commandTimeout: 1000,
      });

      const first = requester.send([['ECHO', 'a']], { timeout: 1000 });
      const second = requester.send([['ECHO', 'b']]);
      const third = requester.send([['ECHO', 'c']], { timeout: 200 });
      const fourth = requester.send([['ECHO', 'd']], { timeout: 200 });

      await flushed();

      assert.deepStrictEqual(connection.writes, [
        commandsToBuffer([
          ['ECHO', 'a'],
          ['ECHO', 'b'],
        ]),
        commandsToBuffer([
          ['ECHO', 'c'],
          ['ECHO', 'd'],
        ]),
      ]);

      connection.reply('+a\r\n+b\r\n+c\r\n+d\r\n');

      assert.deepStrictEqual(
        await Promise.all([first, second, third, fourth]),
        [[['a']], [['b']], [['c']], [['d']]],
      );
    });

    it('lets a request disable or extend the deadline of the client', async () => {
      const { connection, requester } = createRequester({ commandTimeout: 20 });

      const unlimited = requester.send([['PING']], { timeout: 0 });
      const blocking = settle(
        requester.send([['BLPOP', 'k', '0.1']], {
          timeout: 50,
          blockingTimeout: 100,
        }),
      );

      await delay(80);

      connection.reply('+PONG\r\n');

      assert.deepStrictEqual(await unlimited, [['PONG']]);

      const error = await blocking;

      assert.ok(error instanceof SolidisRequesterError);
      assert.strictEqual(error.message, 'Command(s) timed out after 150 ms.');
    });

    it('keeps the connection when a pipeline behind a blocking command times out', async () => {
      const { connection, requester } = createRequester({ commandTimeout: 30 });

      const blocking = requester.send([['BLPOP', 'k', '0']], {
        blockingTimeout: 0,
      });
      const queued = requester.send([['ECHO', 'late']]);

      await assert.rejects(queued, {
        message: 'Command(s) timed out after 30 ms.',
      });

      assert.deepStrictEqual(connection.writes, [
        commandsToBuffer([['BLPOP', 'k', '0']]),
        commandsToBuffer([['ECHO', 'late']]),
      ]);
      assert.strictEqual(connection.resets.length, 0);

      connection.reply('*-1\r\n$4\r\nlate\r\n');

      assert.deepStrictEqual(await blocking, [[null]]);

      const next = requester.send([['PING']]);

      await flushed();

      connection.reply('+PONG\r\n');

      assert.deepStrictEqual(await next, [['PONG']]);
    });

    it('tracks the selected database only after the server accepts SELECT', async () => {
      const { connection, requester } = createRequester();

      assert.strictEqual(requester.database, 0);

      const accepted = requester.send([['SELECT', '3']]);

      await flushed();

      connection.reply('+OK\r\n');

      await accepted;

      assert.strictEqual(requester.database, 3);

      const rejected = requester.send([['select', '99']]);

      await flushed();

      connection.reply('-ERR DB index is out of range\r\n');

      await rejected;

      assert.strictEqual(requester.database, 3);
    });

    it('tracks the protocol negotiated with HELLO', async () => {
      const { connection, requester } = createRequester();

      const exchanges: [string[], string, SolidisProtocols][] = [
        [['HELLO', '3'], '%1\r\n+proto\r\n:3\r\n', SolidisProtocols.RESP3],
        [
          ['HELLO', '4'],
          '-NOPROTO unsupported protocol version\r\n',
          SolidisProtocols.RESP3,
        ],
        [['HELLO'], '%1\r\n+proto\r\n:3\r\n', SolidisProtocols.RESP3],
        [['hello', '2'], '*2\r\n+proto\r\n:2\r\n', SolidisProtocols.RESP2],
      ];

      for (const [command, reply, protocol] of exchanges) {
        const pending = requester.send([command]);

        await flushed();

        connection.reply(reply);

        await pending;

        assert.strictEqual(requester.protocol, protocol, command.join(' '));
      }
    });

    it('resets the tracked session on RESET, back to the configured database', async () => {
      const { connection, pubSub, requester } = createRequester({
        database: 4,
      });

      const pending = requester.send([
        ['SELECT', '5'],
        ['HELLO', '3'],
        ['RESET'],
      ]);

      pubSub.dispatchSubscriptionChange('subscribe', ['subscribe', 'ch', 1]);

      await flushed();

      connection.reply('+OK\r\n%1\r\n+proto\r\n:3\r\n+RESET\r\n');

      await pending;

      assert.strictEqual(requester.database, 4);
      assert.strictEqual(requester.protocol, SolidisProtocols.RESP2);
      assert.strictEqual(pubSub.hasActiveSubscriptions, false);
    });

    it('falls back to RESP2 on close but keeps the database for recovery', async () => {
      const { connection, requester } = createRequester();

      const pending = requester.send([
        ['HELLO', '3'],
        ['SELECT', '2'],
      ]);

      await flushed();

      connection.reply('%1\r\n+proto\r\n:3\r\n+OK\r\n');

      await pending;

      connection.emit(
        'close',
        new SolidisConnectionError('Connection closed.'),
      );

      assert.strictEqual(requester.protocol, SolidisProtocols.RESP2);
      assert.strictEqual(requester.database, 2);
    });

    it('dispatches pub/sub pushes without consuming a reply', async () => {
      const { connection, events, requester } = createRequester();

      const pending = requester.send([['GET', 'k']]);

      await flushed();

      connection.reply(
        '>3\r\n$7\r\nmessage\r\n$2\r\nch\r\n$7\r\npayload\r\n$5\r\nvalue\r\n',
      );

      assert.deepStrictEqual(await pending, [[Buffer.from('value')]]);
      assert.deepStrictEqual(getEvents(events, 'message'), [
        ['ch', Buffer.from('payload')],
      ]);
    });

    it('emits other pushes, such as invalidations, as push events', async () => {
      const { connection, events, requester } = createRequester();

      const pending = requester.send([['GET', 'k']]);

      await flushed();

      connection.reply('>2\r\n$10\r\ninvalidate\r\n*1\r\n$1\r\nk\r\n$-1\r\n');

      assert.deepStrictEqual(await pending, [[null]]);
      assert.deepStrictEqual(getEvents(events, 'push'), [
        [RespPush.from([Buffer.from('invalidate'), [Buffer.from('k')]])],
      ]);

      connection.reply('>2\r\n$10\r\ninvalidate\r\n_\r\n');

      assert.strictEqual(getEvents(events, 'push').length, 2);
      assert.deepStrictEqual(getEvents(events, 'error'), []);
    });

    it('reports a throwing push listener as an error', async () => {
      const failure = new Error('listener failure');
      const { connection, events } = createRequester({}, (event) => {
        if (event === 'push') {
          throw failure;
        }
      });

      connection.reply('>2\r\n$10\r\ninvalidate\r\n_\r\n');

      const [[error]] = getEvents(events, 'error');

      assert.ok(error instanceof SolidisPubSubError);
      assert.strictEqual(error.message, "A 'push' listener threw");
      assert.strictEqual(error.cause, failure);
    });

    it('never treats a RESP2 array reply as a message while nothing is subscribed', async () => {
      const { connection, events, requester } = createRequester();

      const pending = requester.send([['LRANGE', 'k', '0', '-1']]);

      await flushed();

      connection.reply('*3\r\n$7\r\nmessage\r\n$2\r\nch\r\n$7\r\npayload\r\n');

      assert.deepStrictEqual(await pending, [
        [[Buffer.from('message'), Buffer.from('ch'), Buffer.from('payload')]],
      ]);
      assert.deepStrictEqual(events, []);
    });

    it('hands a stray pub/sub-shaped RESP2 reply to the pending SUBSCRIBE', async () => {
      const { connection, events, requester } = createRequester();

      const pending = requester.send([['SUBSCRIBE', 'a']]);
      const next = requester.send([['PING']]);

      await flushed();

      connection.reply(
        '*3\r\n$7\r\nmessage\r\n$1\r\na\r\n$1\r\nx\r\n+PONG\r\n',
      );

      assert.deepStrictEqual(await pending, [
        [[Buffer.from('message'), Buffer.from('a'), Buffer.from('x')]],
      ]);
      assert.deepStrictEqual(await next, [['PONG']]);
      assert.deepStrictEqual(events, []);
    });

    it('applies unsolicited subscription pushes to the tracked state', () => {
      const { connection, events, pubSub } = createRequester();

      pubSub.dispatchSubscriptionChange('ssubscribe', [
        'ssubscribe',
        'shard',
        1,
      ]);

      connection.reply('>3\r\n$12\r\nsunsubscribe\r\n$5\r\nshard\r\n:0\r\n');

      assert.strictEqual(pubSub.hasActiveSubscriptions, false);
      assert.deepStrictEqual(getEvents(events, 'sunsubscribe'), [['shard', 0]]);
      assert.deepStrictEqual(getEvents(events, 'error'), []);
    });

    it('sends an argument-less SUNSUBSCRIBE as is and reads its replies until no shard channel is left', async () => {
      const { connection, pubSub, requester } = createRequester();

      for (const channel of ['a', 'b']) {
        pubSub.dispatchSubscriptionChange('ssubscribe', [
          'ssubscribe',
          channel,
          1,
        ]);
      }

      const unsubscribed = requester.send([['SUNSUBSCRIBE']]);
      const next = requester.send([['PING']]);

      await flushed();

      assert.deepStrictEqual(connection.writes, [
        commandsToBuffer([['SUNSUBSCRIBE'], ['PING']]),
      ]);

      connection.reply(subscribeConfirmation('sunsubscribe', 'b', 1));
      connection.reply(
        `${subscribeConfirmation('sunsubscribe', 'a', 0)}+PONG\r\n`,
      );

      assert.deepStrictEqual(await unsubscribed, [
        [
          [Buffer.from('sunsubscribe'), Buffer.from('b'), 1],
          [Buffer.from('sunsubscribe'), Buffer.from('a'), 0],
        ],
      ]);
      assert.deepStrictEqual(await next, [['PONG']]);
      assert.strictEqual(pubSub.hasActiveSubscriptions, false);

      const empty = requester.send([['SUNSUBSCRIBE']]);
      const unknown = requester.send([['SUNSUBSCRIBE']]);

      await flushed();

      connection.reply(
        "*3\r\n$12\r\nsunsubscribe\r\n$-1\r\n:0\r\n-ERR unknown command 'SUNSUBSCRIBE'\r\n",
      );

      assert.deepStrictEqual(await empty, [
        [[Buffer.from('sunsubscribe'), null, 0]],
      ]);

      const [[refusal]] = await unknown;

      assert.ok(refusal instanceof RespError);
      assert.strictEqual(refusal.code, 'ERR');
    });

    it('resolves SUBSCRIBE only after every channel is confirmed', async () => {
      const { connection, pubSub, requester } = createRequester();

      let isResolved = false;

      const pending = requester
        .send([['SUBSCRIBE', 'a', 'b']])
        .then((replies) => {
          isResolved = true;

          return replies;
        });

      await flushed();

      connection.reply(subscribeConfirmation('subscribe', 'a', 1));

      await flushed();

      assert.strictEqual(isResolved, false);

      connection.reply(subscribeConfirmation('subscribe', 'b', 2));

      const [replies] = await pending;

      assert.strictEqual(replies.length, 2);
      assert.deepStrictEqual(pubSub.getSubscriptions('subscribe'), [
        Buffer.from('a'),
        Buffer.from('b'),
      ]);
    });

    it('delivers RESP2 messages that arrive between subscription confirmations', async () => {
      const { connection, events, requester } = createRequester();

      const first = requester.send([['SUBSCRIBE', 'a']]);

      await flushed();

      connection.reply(subscribeConfirmation('subscribe', 'a', 1));

      await first;

      const second = requester.send([['SUBSCRIBE', 'b']]);

      await flushed();

      connection.reply(
        `*3\r\n$7\r\nmessage\r\n$1\r\na\r\n$4\r\nlate\r\n${subscribeConfirmation('subscribe', 'b', 2)}`,
      );

      const [[confirmation]] = await second;

      assert.deepStrictEqual(confirmation, [
        Buffer.from('subscribe'),
        Buffer.from('b'),
        2,
      ]);
      assert.deepStrictEqual(getEvents(events, 'message'), [
        ['a', Buffer.from('late')],
      ]);
    });

    it('completes a multi-channel subscription on an error so later replies stay aligned', async () => {
      const { connection, requester } = createRequester();

      const failed = requester.send([['SUBSCRIBE', 'a', 'b', 'c']]);
      const next = requester.send([['PING']]);

      await flushed();

      connection.reply('-NOPERM no permissions\r\n+PONG\r\n');

      const [[error, ...rest]] = await failed;

      assert.ok(error instanceof RespError);
      assert.strictEqual(error.code, 'NOPERM');
      assert.deepStrictEqual(rest, []);
      assert.deepStrictEqual(await next, [['PONG']]);
    });

    it('reads the replies of an argument-less UNSUBSCRIBE or PUNSUBSCRIBE until only the other kind is left', async () => {
      const { connection, pubSub, requester } = createRequester();

      pubSub.dispatchSubscriptionChange('subscribe', ['subscribe', 'a', 1]);
      pubSub.dispatchSubscriptionChange('subscribe', ['subscribe', 'b', 2]);
      pubSub.dispatchSubscriptionChange('psubscribe', ['psubscribe', 'p*', 3]);
      pubSub.dispatchSubscriptionChange('ssubscribe', ['ssubscribe', 's', 1]);

      const channels = requester.send([['UNSUBSCRIBE']]);
      const patterns = requester.send([['PUNSUBSCRIBE']]);
      const next = requester.send([['PING']]);

      await flushed();

      assert.deepStrictEqual(connection.writes, [
        commandsToBuffer([['UNSUBSCRIBE'], ['PUNSUBSCRIBE'], ['PING']]),
      ]);

      connection.reply(
        subscribeConfirmation('unsubscribe', 'b', 2) +
          subscribeConfirmation('unsubscribe', 'a', 1),
      );

      assert.strictEqual((await channels)[0].length, 2);
      assert.deepStrictEqual(pubSub.getSubscriptions('psubscribe'), [
        Buffer.from('p*'),
      ]);

      connection.reply(
        `${subscribeConfirmation('punsubscribe', 'p*', 0)}*2\r\n$4\r\npong\r\n$0\r\n\r\n`,
      );

      assert.strictEqual((await patterns)[0].length, 1);
      assert.deepStrictEqual(await next, [
        [[Buffer.from('pong'), Buffer.from('')]],
      ]);
      assert.deepStrictEqual(pubSub.getSubscriptions('ssubscribe'), [
        Buffer.from('s'),
      ]);
    });

    it('rejects on the first error reply but still consumes the rest of the batch', async () => {
      const { connection, requester } = createRequester({
        rejectOnPartialPipelineError: true,
      });

      const failed = requester.send([
        ['GET', 'a'],
        ['INCR', 's'],
        ['GET', 'b'],
      ]);
      const next = requester.send([['PING']]);

      await flushed();

      connection.reply(
        '$1\r\na\r\n-ERR value is not an integer or out of range\r\n$1\r\nb\r\n+PONG\r\n',
      );

      await assert.rejects(
        failed,
        (error: unknown) =>
          error instanceof SolidisCommandError &&
          error.message ===
            '[INCR] ERR value is not an integer or out of range' &&
          error.cause instanceof RespError &&
          error.cause.code === 'ERR',
      );
      assert.deepStrictEqual(await next, [['PONG']]);
    });

    it('logs serialized pipelines by command name, without arguments', async () => {
      const messages: string[] = [];
      const { connection, requester } = createRequester(
        {},
        undefined,
        (_type, message) => messages.push(message),
      );
      const commands = [
        ['AUTH', 'user', 'secret'],
        ['acl', 'setuser', 'alice', '>secret'],
        ['PING'],
      ];

      const pending = requester.send(commands);

      await flushed();

      connection.reply('+OK\r\n+OK\r\n+PONG\r\n');

      await pending;

      assert.deepStrictEqual(messages, [
        `Requester serialized ${commandsToBuffer(commands).length} bytes: AUTH, ACL SETUSER, PING`,
        'Requester received 17 bytes',
      ]);
    });

    it('rejects a request with an argument that is not a string or Buffer and keeps the batch intact', async () => {
      const { connection, requester } = createRequester();

      const numeric = requester.send([['SET', 'k', 5 as unknown as string]]);
      const missing = requester.send([
        ['MSET', 'a', '1', 'b', undefined as unknown as string],
      ]);
      const name = requester.send([[7 as unknown as string]]);
      const valid = requester.send([['GET', 'k']]);

      await assert.rejects(numeric, {
        name: 'SolidisRequesterError',
        message: 'SET takes only strings and Buffers.',
      });
      await assert.rejects(missing, {
        message: 'MSET takes only strings and Buffers.',
      });
      await assert.rejects(name, {
        message: '7 takes only strings and Buffers.',
      });

      await flushed();

      assert.deepStrictEqual(connection.writes, [
        commandsToBuffer([['GET', 'k']]),
      ]);

      connection.reply('$1\r\nv\r\n');

      assert.deepStrictEqual(await valid, [[Buffer.from('v')]]);
    });

    it('rejects commands whose replies the server skips or reshapes', async () => {
      const { connection, requester } = createRequester();

      const unsupported: [string[], string][] = [
        [['MONITOR'], 'MONITOR'],
        [['psync', '?', '-1'], 'PSYNC'],
        [['CLIENT', 'REPLY', 'OFF'], 'CLIENT REPLY'],
        [['client', 'reply', 'skip'], 'CLIENT REPLY'],
        [['REPLCONF', 'ACK', '0'], 'REPLCONF'],
        [['replconf', 'getack', '*'], 'REPLCONF'],
        [['SCRIPT', 'DEBUG', 'YES'], 'SCRIPT DEBUG'],
        [['script', 'debug', 'sync'], 'SCRIPT DEBUG'],
      ];

      for (const [command, name] of unsupported) {
        await assert.rejects(requester.send([['PING'], command]), {
          name: 'SolidisRequesterError',
          message: `${name} is not supported: it breaks the pairing of requests and replies.`,
        });
      }

      const supported = requester.send([
        ['CLIENT', 'REPLY', 'ON'],
        ['SCRIPT', 'DEBUG', 'NO'],
        ['REPLCONF', 'LISTENING-PORT', '6380'],
        ['CLIENT', 'ID'],
      ]);

      await flushed();

      assert.strictEqual(connection.writes.length, 1);

      connection.reply('+OK\r\n+OK\r\n+OK\r\n:7\r\n');

      assert.deepStrictEqual(await supported, [['OK'], ['OK'], ['OK'], [7]]);
    });

    it('unsubscribes from channels whose SUBSCRIBE is still in flight on an argument-less UNSUBSCRIBE', async () => {
      const { connection, pubSub, requester } = createRequester();
      const binary = Buffer.from([0x76, 0xff]);

      pubSub.dispatchSubscriptionChange('subscribe', ['subscribe', 'a', 1]);

      const inflight = requester.send([['SUBSCRIBE', 'b', 'c']]);

      await flushed();

      const sameFlush = requester.send([
        ['PSUBSCRIBE', 'p*'],
        ['SUBSCRIBE', binary],
        ['UNSUBSCRIBE'],
      ]);
      const next = requester.send([['GET', 'k']]);

      await flushed();

      assert.deepStrictEqual(connection.writes, [
        commandsToBuffer([['SUBSCRIBE', 'b', 'c']]),
        commandsToBuffer([
          ['PSUBSCRIBE', 'p*'],
          ['SUBSCRIBE', binary],
          ['UNSUBSCRIBE'],
          ['GET', 'k'],
        ]),
      ]);

      connection.reply(
        subscribeConfirmation('subscribe', 'b', 2) +
          subscribeConfirmation('subscribe', 'c', 3) +
          subscribeConfirmation('psubscribe', 'p*', 4) +
          '*3\r\n$9\r\nsubscribe\r\n$2\r\nv\xff\r\n:5\r\n' +
          subscribeConfirmation('unsubscribe', 'a', 4) +
          subscribeConfirmation('unsubscribe', 'b', 3) +
          subscribeConfirmation('unsubscribe', 'c', 2) +
          '*3\r\n$11\r\nunsubscribe\r\n$2\r\nv\xff\r\n:1\r\n' +
          '$5\r\nvalue\r\n',
      );

      assert.strictEqual((await inflight)[0].length, 2);

      const [[psubscribed], [subscribed], unsubscribed] = await sameFlush;

      assert.deepStrictEqual(psubscribed, [
        Buffer.from('psubscribe'),
        Buffer.from('p*'),
        4,
      ]);
      assert.deepStrictEqual(subscribed, [Buffer.from('subscribe'), binary, 5]);
      assert.strictEqual(unsubscribed.length, 4);
      assert.deepStrictEqual(await next, [[Buffer.from('value')]]);
      assert.strictEqual(pubSub.getSubscriptions('subscribe').length, 0);
      assert.deepStrictEqual(pubSub.getSubscriptions('psubscribe'), [
        Buffer.from('p*'),
      ]);
    });

    it('ends an argument-less UNSUBSCRIBE with the replies of the channels the server took', async () => {
      const { connection, pubSub, requester } = createRequester();
      const subscribed = requester.send([
        ['SUBSCRIBE', 'a'],
        ['SUBSCRIBE', 'x'],
      ]);

      await flushed();

      connection.reply(
        `${subscribeConfirmation('subscribe', 'a', 1)}-NOPERM no permissions\r\n`,
      );

      const [, [refusal]] = await subscribed;

      assert.ok(refusal instanceof RespError);

      const unsubscribed = requester.send([['UNSUBSCRIBE']]);

      await flushed();

      assert.deepStrictEqual(
        connection.writes.at(-1),
        commandsToBuffer([['UNSUBSCRIBE']]),
      );

      connection.reply(subscribeConfirmation('unsubscribe', 'a', 0));

      assert.strictEqual((await unsubscribed)[0].length, 1);
      assert.deepStrictEqual(pubSub.getSubscriptions('subscribe'), []);
    });

    it('sends argument-less UNSUBSCRIBEs in time that does not grow with the requests in flight', async () => {
      const { connection, requester } = createRequester();
      const backlog = settle(
        requester.send(Array.from({ length: 200_000 }, () => ['GET', 'k'])),
      );

      await flushed();

      const unsubscribes = Array.from({ length: 20_000 }, () =>
        settle(requester.send([['UNSUBSCRIBE']])),
      );
      const startedAt = performance.now();

      await flushed();

      const elapsed = performance.now() - startedAt;

      assert.ok(elapsed < 300, `${elapsed} ms`);
      assert.strictEqual(connection.writes.length, 667 + 67);

      connection.emit('close', new SolidisConnectionError('lost'));

      await Promise.all([backlog, ...unsubscribes]);
    });

    it('rejects subscription commands while a transaction is open', async () => {
      const { connection, requester } = createRequester();

      const opened = requester.send([['MULTI']]);
      const inside = requester.send([['SUBSCRIBE', 'x']]);
      const queued = requester.send([['SET', 'k', 'v']]);
      const whole = requester.send([['PUNSUBSCRIBE'], ['EXEC']]);
      const executed = requester.send([['EXEC']]);
      const after = requester.send([['SUBSCRIBE', 'y']]);
      const rejectedTransaction = requester.send([
        ['MULTI'],
        ['SSUBSCRIBE', 's'],
        ['EXEC'],
      ]);
      const stillClosed = requester.send([['SUNSUBSCRIBE', 's']]);

      for (const [pending, name] of [
        [inside, 'SUBSCRIBE'],
        [whole, 'PUNSUBSCRIBE'],
        [rejectedTransaction, 'SSUBSCRIBE'],
      ] as const) {
        await assert.rejects(pending, {
          name: 'SolidisRequesterError',
          message: `${name} is not supported inside a transaction: it breaks the pairing of requests and replies.`,
        });
      }

      await flushed();

      assert.deepStrictEqual(connection.writes, [
        commandsToBuffer([
          ['MULTI'],
          ['SET', 'k', 'v'],
          ['EXEC'],
          ['SUBSCRIBE', 'y'],
          ['SUNSUBSCRIBE', 's'],
        ]),
      ]);

      connection.reply(
        '+OK\r\n+QUEUED\r\n*1\r\n+OK\r\n' +
          subscribeConfirmation('subscribe', 'y', 1) +
          subscribeConfirmation('sunsubscribe', 's', 0),
      );

      assert.deepStrictEqual(await opened, [['OK']]);
      assert.deepStrictEqual(await queued, [['QUEUED']]);
      assert.deepStrictEqual(await executed, [[['OK']]]);
      assert.strictEqual((await after)[0].length, 1);
      assert.strictEqual((await stillClosed)[0].length, 1);
    });

    it('applies SELECT, HELLO and AUTH queued in a transaction only when EXEC runs them', async () => {
      const { connection, requester } = createRequester();

      const discarded = requester.send([
        ['MULTI'],
        ['SELECT', '3'],
        ['HELLO', '3'],
        ['AUTH', 'alice', 'secret'],
        ['DISCARD'],
      ]);

      await flushed();

      connection.reply('+OK\r\n+QUEUED\r\n+QUEUED\r\n+QUEUED\r\n+OK\r\n');

      await discarded;

      assert.strictEqual(requester.database, 0);
      assert.strictEqual(requester.protocol, SolidisProtocols.RESP2);
      assert.strictEqual(requester.authentication, undefined);

      const aborted = requester.send([['MULTI'], ['SELECT', '4'], ['EXEC']]);

      await flushed();

      connection.reply('+OK\r\n+QUEUED\r\n*-1\r\n');

      assert.deepStrictEqual(await aborted, [['OK'], ['QUEUED'], [null]]);
      assert.strictEqual(requester.database, 0);

      const failed = requester.send([['MULTI'], ['SELECT', '4'], ['EXEC']]);

      await flushed();

      connection.reply(
        '+OK\r\n+QUEUED\r\n-EXECABORT Transaction discarded because of previous errors.\r\n',
      );

      await failed;

      assert.strictEqual(requester.database, 0);

      const executed = requester.send([
        ['MULTI'],
        ['SELECT', '3'],
        ['GET', 'k'],
        ['AUTH', 'alice', 'secret'],
        ['HELLO', '3'],
        ['EXEC'],
      ]);

      await flushed();

      connection.reply(
        '+OK\r\n+QUEUED\r\n+QUEUED\r\n+QUEUED\r\n+QUEUED\r\n*4\r\n+OK\r\n$1\r\nv\r\n+OK\r\n%1\r\n+proto\r\n:3\r\n',
      );

      const replies = await executed;

      assert.deepStrictEqual(replies.at(-1)?.[0], [
        'OK',
        Buffer.from('v'),
        'OK',
        new Map([['proto', 3]]),
      ]);
      assert.strictEqual(requester.database, 3);
      assert.strictEqual(requester.protocol, SolidisProtocols.RESP3);
      assert.deepStrictEqual(requester.authentication, {
        username: 'alice',
        password: 'secret',
      });
    });

    it('tracks the credentials of AUTH and HELLO AUTH and forgets them on RESET', async () => {
      const { connection, requester } = createRequester();

      const exchanges: [string[], string, unknown][] = [
        [
          ['AUTH', 'secret'],
          '+OK\r\n',
          { username: 'default', password: 'secret' },
        ],
        [
          ['AUTH', 'mallory', 'wrong'],
          '-WRONGPASS invalid username-password pair\r\n',
          { username: 'default', password: 'secret' },
        ],
        [
          ['HELLO', '3', 'AUTH', 'alice', 'pw', 'SETNAME', 'app'],
          '%1\r\n+proto\r\n:3\r\n',
          { username: 'alice', password: 'pw' },
        ],
        [
          ['HELLO', '3', 'SETNAME', 'AUTH'],
          '%1\r\n+proto\r\n:3\r\n',
          { username: 'alice', password: 'pw' },
        ],
        [
          ['HELLO', '3', 'SETNAME', 'app', 'AUTH', 'dave', 'pw4'],
          '%1\r\n+proto\r\n:3\r\n',
          { username: 'dave', password: 'pw4' },
        ],
        [
          ['HELLO', '3', 'SETNAME', 'AUTH', 'AUTH', 'erin', 'pw5'],
          '%1\r\n+proto\r\n:3\r\n',
          { username: 'erin', password: 'pw5' },
        ],
        [
          ['auth', 'bob', 'pw2'],
          '+OK\r\n',
          { username: 'bob', password: 'pw2' },
        ],
        [
          ['hello', '3', 'auth', 'frank', 'pw6'],
          '%1\r\n+proto\r\n:3\r\n',
          { username: 'frank', password: 'pw6' },
        ],
        [['RESET'], '+RESET\r\n', undefined],
      ];

      for (const [command, reply, authentication] of exchanges) {
        const pending = requester.send([command]);

        await flushed();

        connection.reply(reply);

        await pending;

        assert.deepStrictEqual(
          requester.authentication,
          authentication,
          command.join(' '),
        );
      }

      const kept = requester.send([['AUTH', 'carol', 'pw3']]);

      await flushed();

      connection.reply('+OK\r\n');

      await kept;

      connection.emit('close', new SolidisConnectionError('lost'));

      assert.deepStrictEqual(requester.authentication, {
        username: 'carol',
        password: 'pw3',
      });
    });

    it('discards a transaction whose WATCH was lost with the connection', async () => {
      const { connection, requester } = createRequester();

      async function exchange(commands: string[][], reply: string) {
        const pending = requester.send(commands);

        await flushed();

        connection.reply(reply);

        return await pending;
      }

      await exchange([['WATCH', 'balance']], '+OK\r\n');

      connection.emit('close', new SolidisConnectionError('lost'));

      const discarded = requester.send([
        ['MULTI'],
        ['SET', 'balance', '90'],
        ['EXEC'],
      ]);

      await flushed();

      assert.deepStrictEqual(
        connection.writes.at(-1),
        commandsToBuffer([['MULTI'], ['SET', 'balance', '90'], ['DISCARD']]),
      );

      connection.reply('+OK\r\n+QUEUED\r\n+OK\r\n');

      assert.deepStrictEqual(await discarded, [['OK'], ['QUEUED'], [null]]);

      assert.deepStrictEqual(
        await exchange(
          [['MULTI'], ['SET', 'balance', '90'], ['EXEC']],
          '+OK\r\n+QUEUED\r\n*1\r\n+OK\r\n',
        ),
        [['OK'], ['QUEUED'], [['OK']]],
      );

      await exchange([['WATCH', 'balance']], '+OK\r\n');

      connection.emit('close', new SolidisConnectionError('lost'));

      const rewatched = requester.send([
        ['WATCH', 'other'],
        ['MULTI'],
        ['EXEC'],
      ]);

      await flushed();

      assert.deepStrictEqual(
        connection.writes.at(-1),
        commandsToBuffer([['WATCH', 'other'], ['MULTI'], ['DISCARD']]),
      );

      connection.reply('+OK\r\n+OK\r\n+OK\r\n');

      assert.deepStrictEqual(await rewatched, [['OK'], ['OK'], [null]]);
      assert.deepStrictEqual(
        await exchange(
          [['WATCH', 'balance'], ['MULTI'], ['EXEC']],
          '+OK\r\n+OK\r\n*0\r\n',
        ),
        [['OK'], ['OK'], [[]]],
      );

      await exchange([['WATCH', 'balance']], '+OK\r\n');

      connection.emit('close', new SolidisConnectionError('lost'));

      await exchange([['UNWATCH']], '+OK\r\n');

      assert.deepStrictEqual(
        await exchange([['MULTI'], ['EXEC']], '+OK\r\n*0\r\n'),
        [['OK'], [[]]],
      );

      await exchange([['WATCH', 'balance']], '+OK\r\n');
      await exchange([['MULTI'], ['EXEC']], '+OK\r\n*0\r\n');

      connection.emit('close', new SolidisConnectionError('lost'));

      assert.deepStrictEqual(
        await exchange([['MULTI'], ['EXEC']], '+OK\r\n*0\r\n'),
        [['OK'], [[]]],
      );

      await exchange([['WATCH', 'balance']], '+OK\r\n');

      connection.emit('close', new SolidisConnectionError('lost'));

      const queuedUnwatch = requester.send([['MULTI'], ['UNWATCH'], ['EXEC']]);

      await flushed();

      assert.deepStrictEqual(
        connection.writes.at(-1),
        commandsToBuffer([['MULTI'], ['UNWATCH'], ['DISCARD']]),
      );

      connection.reply('+OK\r\n+QUEUED\r\n+OK\r\n');

      assert.deepStrictEqual(await queuedUnwatch, [['OK'], ['QUEUED'], [null]]);

      await exchange([['WATCH', 'balance']], '+OK\r\n');

      connection.emit('close', new SolidisConnectionError('lost'));

      const [[strayExec], [strayDiscard]] = await exchange(
        [['EXEC'], ['DISCARD']],
        '-ERR EXEC without MULTI\r\n-ERR DISCARD without MULTI\r\n',
      );

      assert.ok(strayExec instanceof RespError);
      assert.ok(strayDiscard instanceof RespError);
      assert.deepStrictEqual(
        await exchange([['MULTI'], ['EXEC']], '+OK\r\n+OK\r\n'),
        [['OK'], [null]],
      );

      await exchange([['WATCH', 'balance']], '+OK\r\n');

      connection.emit('close', new SolidisConnectionError('lost'));

      await exchange([['RESET']], '+RESET\r\n');

      assert.deepStrictEqual(
        await exchange([['MULTI'], ['EXEC']], '+OK\r\n*0\r\n'),
        [['OK'], [[]]],
      );
    });

    it('rejects in strict mode only on top-level errors, with a redacted SolidisCommandError', async () => {
      const { connection, requester } = createRequester({
        rejectOnPartialPipelineError: true,
      });

      const nested = requester.send([['MULTI'], ['INCR', 's'], ['EXEC']]);

      await flushed();

      connection.reply(
        '+OK\r\n+QUEUED\r\n*1\r\n-ERR value is not an integer or out of range\r\n',
      );

      const [, , [results]] = await nested;

      assert.ok(Array.isArray(results));
      assert.ok(results[0] instanceof RespError);

      const failed = requester.send([
        ['ACL', 'SETUSER', 'alice', 'on', "<pass'word"],
      ]);

      await flushed();

      connection.reply(
        "-ERR Error in ACL SETUSER modifier '<pass'word': Syntax error\r\n",
      );

      await assert.rejects(failed, (error: unknown) => {
        assert.ok(error instanceof SolidisCommandError);
        assert.strictEqual(
          error.message,
          "[ACL SETUSER] ERR Error in ACL SETUSER modifier '***': Syntax error",
        );
        assert.ok(error.cause instanceof RespError);
        assert.strictEqual(error.cause.code, 'ERR');
        assert.strictEqual(
          error.cause.message,
          "ERR Error in ACL SETUSER modifier '***': Syntax error",
        );

        return true;
      });
    });

    it('never arms a deadline that Node would truncate', async () => {
      const warnings: Error[] = [];
      const onWarning = (warning: Error) => warnings.push(warning);

      process.on('warning', onWarning);

      try {
        const { connection, requester } = createRequester({
          commandTimeout: 30,
        });

        const forever = settle(
          requester.send([['BLPOP', 'k', '3000000']], {
            blockingTimeout: 3_000_000_000,
          }),
        );
        const huge = settle(
          requester.send([['GET', 'k']], { timeout: 2_147_483_648 }),
        );
        const negative = settle(
          requester.send([['BLPOP', 'k', '-5']], { blockingTimeout: -5000 }),
        );

        const error = await negative;

        assert.strictEqual(connection.resets.length, 1);
        assert.ok(error instanceof SolidisRequesterError);
        assert.strictEqual(error.message, 'Command(s) timed out after 30 ms.');
        for (const pending of [forever, huge]) {
          const reset = await pending;

          assert.ok(reset instanceof SolidisRequesterError);
          assert.strictEqual(
            reset.message,
            'Connection reset because a command timed out.',
          );
        }
        assert.deepStrictEqual(
          warnings.filter(({ name }) => name === 'TimeoutOverflowWarning'),
          [],
        );
      } finally {
        process.off('warning', onWarning);
      }
    });
  });
});

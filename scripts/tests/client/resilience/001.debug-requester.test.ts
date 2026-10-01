/**
 * Debug infrastructure and requester module internals: debug memory capacity
 * and lifecycle, debug transforms, debug handle generation, requester fault
 * recovery and pipeline chunking, and the DEBUG command itself.
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
  SolidisDebugMemory,
  SolidisDefaultOptions,
  SolidisParserError,
  SolidisProtocols,
  SolidisPubSub,
  SolidisRequester,
  SolidisRequesterError,
} from '../../../../sources/index.ts';
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

  describe('debug memory', () => {
    it('writes entries and respects max capacity', async () => {
      const { SolidisDebugMemory } = await import(
        '../../../../sources/modules/debug.ts'
      );

      const memory = new SolidisDebugMemory(3);

      memory.write({ type: 'debug', message: 'one' });
      memory.write({ type: 'debug', message: 'two' });
      memory.write({ type: 'debug', message: 'three' });
      memory.write({ type: 'debug', message: 'four' });

      const logs = memory.getLogs();

      assert.strictEqual(logs.length, 3);
      assert.strictEqual(logs[0].type, 'debug');
      assert.strictEqual(logs[0].message, 'two');
      assert.strictEqual(logs[1].type, 'debug');
      assert.strictEqual(logs[1].message, 'three');
      assert.strictEqual(logs[2].type, 'debug');
      assert.strictEqual(logs[2].message, 'four');

      for (const entry of logs) {
        assert.ok(
          typeof entry.timestamp === 'number' &&
            Number.isFinite(entry.timestamp) &&
            entry.timestamp > 0,
          `expected positive finite timestamp, got ${entry.timestamp}`,
        );
      }
    });

    it('clears logs', async () => {
      const { SolidisDebugMemory } = await import(
        '../../../../sources/modules/debug.ts'
      );

      const memory = new SolidisDebugMemory(10);

      memory.write({ type: 'info', message: 'data' });

      const logsBeforeClear = memory.getLogs();

      assert.strictEqual(logsBeforeClear.length, 1);
      assert.strictEqual(logsBeforeClear[0].type, 'info');
      assert.strictEqual(logsBeforeClear[0].message, 'data');
      assert.ok(
        typeof logsBeforeClear[0].timestamp === 'number' &&
          Number.isFinite(logsBeforeClear[0].timestamp) &&
          logsBeforeClear[0].timestamp > 0,
      );

      memory.clearLogs();

      assert.strictEqual(memory.getLogs().length, 0);
    });

    it('adds timestamp when not provided', async () => {
      const { SolidisDebugMemory } = await import(
        '../../../../sources/modules/debug.ts'
      );

      const memory = new SolidisDebugMemory(10);

      memory.write({ type: 'warn', message: 'no timestamp' });

      const logs = memory.getLogs();

      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].type, 'warn');
      assert.strictEqual(logs[0].message, 'no timestamp');
      assert.ok(
        typeof logs[0].timestamp === 'number' &&
          Number.isFinite(logs[0].timestamp) &&
          logs[0].timestamp > 0,
      );
    });

    it('emits pushed event on write', async () => {
      const { SolidisDebugMemory } = await import(
        '../../../../sources/modules/debug.ts'
      );

      const memory = new SolidisDebugMemory(10);

      let emittedEntry: unknown = null;

      memory.on('pushed', (entry) => {
        emittedEntry = entry;
      });

      memory.write({ type: 'debug', message: 'event test' });

      await new Promise<void>((resolve) => setImmediate(resolve));

      if (typeof emittedEntry !== 'object' || emittedEntry === null) {
        assert.fail('write must emit a debug log entry object');
      }

      if (
        !('type' in emittedEntry) ||
        !('message' in emittedEntry) ||
        !('timestamp' in emittedEntry)
      ) {
        assert.fail('emitted entry must include type, message, and timestamp');
      }

      assert.strictEqual(emittedEntry.type, 'debug');
      assert.strictEqual(emittedEntry.message, 'event test');
      assert.ok(
        typeof emittedEntry.timestamp === 'number' &&
          Number.isFinite(emittedEntry.timestamp) &&
          emittedEntry.timestamp > 0,
      );
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

    it('keeps no entries at zero capacity but still emits pushed', () => {
      const memory = new SolidisDebugMemory(0);
      const pushed: unknown[] = [];

      memory.on('pushed', (entry) => pushed.push(entry));
      memory.write({ type: 'info', message: 'dropped' });

      assert.deepStrictEqual(memory.getLogs(), []);
      assert.strictEqual(pushed.length, 1);
    });

    it('returns logs oldest first as a frozen snapshot after wrapping', () => {
      const memory = new SolidisDebugMemory(3);

      for (let index = 0; index < 7; index += 1) {
        memory.write({ type: 'info', message: `${index}`, timestamp: index });
      }

      const logs = memory.getLogs();

      assert.deepStrictEqual(
        logs.map(({ message }) => message),
        ['4', '5', '6'],
      );
      assert.strictEqual(Object.isFrozen(logs), true);

      memory.write({ type: 'info', message: '7', timestamp: 7 });

      assert.deepStrictEqual(
        logs.map(({ message }) => message),
        ['4', '5', '6'],
      );
    });
  });

  describe('debug handle generator', () => {
    it('returns undefined when no debug memory provided', async () => {
      const { generateDebugHandle } = await import(
        '../../../../sources/common/utils/debug.ts'
      );

      const handle = generateDebugHandle(undefined);

      assert.strictEqual(handle, undefined);
    });

    it('returns a function that writes to debug memory', async () => {
      const { generateDebugHandle } = await import(
        '../../../../sources/common/utils/debug.ts'
      );
      const { SolidisDebugMemory } = await import(
        '../../../../sources/modules/debug.ts'
      );

      const memory = new SolidisDebugMemory(10);
      const handle = generateDebugHandle(memory);

      if (handle === undefined) {
        assert.fail(
          'generateDebugHandle must return a function when memory is provided',
        );
      }

      handle('info', 'test message', { extra: true });

      await new Promise<void>((resolve) => setImmediate(resolve));

      const logs = memory.getLogs();

      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].type, 'info');
      assert.strictEqual(logs[0].message, 'test message');
      assert.ok(
        typeof logs[0].timestamp === 'number' &&
          Number.isFinite(logs[0].timestamp) &&
          logs[0].timestamp > 0,
      );
      assert.deepStrictEqual(logs[0].data, { extra: true });
    });
  });

  describe('debug stream via DEBUG environment variable', () => {
    it('pipes formatted log entries to stdout when DEBUG includes solidis', async () => {
      const originalDebug = process.env.DEBUG;

      process.env.DEBUG = 'solidis';

      try {
        const { SolidisDebugMemory } = await import(
          '../../../../sources/modules/debug.ts'
        );

        const memory = new SolidisDebugMemory(10);

        const stdoutChunks: string[] = [];
        const originalStdoutWrite = process.stdout.write.bind(process.stdout);

        const interceptingWrite: typeof process.stdout.write = (
          chunk: Uint8Array | string,
          encodingOrCallback?:
            | BufferEncoding
            | ((error?: Error | null) => void),
          callback?: (error?: Error | null) => void,
        ): boolean => {
          stdoutChunks.push(
            typeof chunk === 'string'
              ? chunk
              : Buffer.from(chunk).toString('utf8'),
          );
          if (typeof encodingOrCallback === 'function') {
            return originalStdoutWrite(chunk, encodingOrCallback);
          }
          return originalStdoutWrite(chunk, encodingOrCallback, callback);
        };

        process.stdout.write = interceptingWrite;

        try {
          memory.write({ type: 'info', message: 'env-activated debug' });

          await waitFor(
            () => stdoutChunks.join('').includes('[Solidis info]'),
            {
              timeout: 3000,
              interval: 10,
              description: 'debug entry piped to stdout',
            },
          );

          const combinedOutput = stdoutChunks.join('');

          assert.ok(
            combinedOutput.includes('[Solidis info] env-activated debug'),
            'when DEBUG=solidis, SolidisDebugMemory must pipe formatted ' +
              `entries to stdout but captured: ${combinedOutput.slice(0, 200)}`,
          );
        } finally {
          process.stdout.write = originalStdoutWrite;
        }

        const logs = memory.getLogs();

        assert.strictEqual(logs.length, 1);
        assert.strictEqual(logs[0].type, 'info');
        assert.strictEqual(logs[0].message, 'env-activated debug');
        assert.ok(
          typeof logs[0].timestamp === 'number' &&
            Number.isFinite(logs[0].timestamp) &&
            logs[0].timestamp > 0,
        );
      } finally {
        if (originalDebug === undefined) {
          delete process.env.DEBUG;
        } else {
          process.env.DEBUG = originalDebug;
        }
      }
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
          error.message === 'Not connected with redis server.',
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
          error instanceof RespError &&
          error.message === 'ERR value is not an integer or out of range',
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
        async () => (await killerClient.clientList()).includes('cmd=blpop'),
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

  describe('sanitizeCommandsBufferForDebug', () => {
    it('returns the original buffer for commands without credentials', async () => {
      const { commandsToBuffer, sanitizeCommandsBufferForDebug } = await import(
        '../../../../sources/index.ts'
      );

      const commands = [
        ['SET', 'key', 'value'],
        ['GET', 'key'],
      ];

      const buffer = commandsToBuffer(commands);
      const result = sanitizeCommandsBufferForDebug(buffer, commands);

      assert.strictEqual(result, buffer.toString());
    });

    it('masks all arguments of an AUTH command', async () => {
      const { commandsToBuffer, sanitizeCommandsBufferForDebug } = await import(
        '../../../../sources/index.ts'
      );

      const commands = [['AUTH', 'myuser', 'supersecret']];
      const buffer = commandsToBuffer(commands);
      const result = sanitizeCommandsBufferForDebug(buffer, commands);

      assert.strictEqual(
        result,
        '*3\r\n$4\r\nAUTH\r\n$3\r\n***\r\n$3\r\n***\r\n',
      );
    });

    it('masks all arguments of a HELLO command', async () => {
      const { commandsToBuffer, sanitizeCommandsBufferForDebug } = await import(
        '../../../../sources/index.ts'
      );

      const commands = [['HELLO', '3', 'AUTH', 'admin', 'password123']];
      const buffer = commandsToBuffer(commands);
      const result = sanitizeCommandsBufferForDebug(buffer, commands);

      assert.strictEqual(
        result,
        '*5\r\n$5\r\nHELLO\r\n$3\r\n***\r\n$3\r\n***\r\n$3\r\n***\r\n$3\r\n***\r\n',
      );
    });

    it('only masks credential commands in a mixed pipeline', async () => {
      const { commandsToBuffer, sanitizeCommandsBufferForDebug } = await import(
        '../../../../sources/index.ts'
      );

      const commands = [
        ['SET', 'visible-key', 'visible-value'],
        ['AUTH', 'secret-user', 'secret-pass'],
        ['GET', 'another-key'],
      ];

      const buffer = commandsToBuffer(commands);
      const result = sanitizeCommandsBufferForDebug(buffer, commands);

      assert.strictEqual(
        result,
        '*3\r\n$3\r\nSET\r\n$11\r\nvisible-key\r\n$13\r\nvisible-value\r\n*3\r\n$4\r\nAUTH\r\n$3\r\n***\r\n$3\r\n***\r\n*2\r\n$3\r\nGET\r\n$11\r\nanother-key\r\n',
      );
    });

    it('handles case-insensitive command names', async () => {
      const { commandsToBuffer, sanitizeCommandsBufferForDebug } = await import(
        '../../../../sources/index.ts'
      );

      const commands = [['auth', 'user', 'pass']];
      const buffer = commandsToBuffer(commands);
      const result = sanitizeCommandsBufferForDebug(buffer, commands);

      assert.strictEqual(
        result,
        '*3\r\n$4\r\nauth\r\n$3\r\n***\r\n$3\r\n***\r\n',
      );
    });

    it('masks MIGRATE, ACL SETUSER and CONFIG SET arguments but keeps their names', async () => {
      const { commandsToBuffer, sanitizeCommandsBufferForDebug } = await import(
        '../../../../sources/index.ts'
      );

      const commands = [
        ['MIGRATE', 'host', '6379', 'key', '0', '1000', 'AUTH', 'secret'],
        ['acl', 'setuser', 'alice', '>secret'],
        ['CONFIG', 'SET', 'requirepass', 'secret'],
        ['CONFIG', 'GET', 'maxmemory'],
      ];

      const result = sanitizeCommandsBufferForDebug(
        commandsToBuffer(commands),
        commands,
      );

      assert.strictEqual(result.includes('secret'), false);
      assert.strictEqual(
        result,
        commandsToBuffer([
          ['MIGRATE', '***', '***', '***', '***', '***', '***', '***'],
          ['acl', 'setuser', '***', '***'],
          ['CONFIG', 'SET', '***', '***'],
          ['CONFIG', 'GET', 'maxmemory'],
        ]).toString(),
      );
    });

    it('masks credential commands given as buffers', async () => {
      const { commandsToBuffer, sanitizeCommandsBufferForDebug } = await import(
        '../../../../sources/index.ts'
      );

      const commands = [[Buffer.from('AUTH'), Buffer.from('secret')]];

      assert.strictEqual(
        sanitizeCommandsBufferForDebug(commandsToBuffer(commands), commands),
        '*2\r\n$4\r\nAUTH\r\n$3\r\n***\r\n',
      );
    });

    it('truncates a long preview', async () => {
      const { commandsToBuffer, sanitizeCommandsBufferForDebug } = await import(
        '../../../../sources/index.ts'
      );

      const commands = [['SET', 'key', 'x'.repeat(2000)]];
      const buffer = commandsToBuffer(commands);

      assert.strictEqual(
        sanitizeCommandsBufferForDebug(buffer, commands),
        `${buffer.toString('utf8', 0, 1024)}...`,
      );
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
      debugMemory?: SolidisDebugMemory,
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
        debugMemory,
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

      connection.reply('+UNSOLICITED\r\n');

      const [[error]] = getEvents(events, 'error');

      assert.ok(error instanceof SolidisRequesterError);
      assert.strictEqual(
        error.message,
        'Received reply with no pending request',
      );
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

    it('rejects in-flight and unflushed requests when the connection closes', async () => {
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
      assert.strictEqual(await unflushed, error);

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
        message: 'Cannot send an empty command.',
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

      await delay(40);

      connection.reply('+PONG\r\n');

      assert.deepStrictEqual(await pending, [['PONG']]);
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

    it('resets the tracked session on RESET', async () => {
      const { connection, pubSub, requester } = createRequester();

      const pending = requester.send([
        ['SELECT', '5'],
        ['HELLO', '3'],
        ['RESET'],
      ]);

      pubSub.dispatchSubscriptionChange('subscribe', ['subscribe', 'ch', 1]);

      await flushed();

      connection.reply('+OK\r\n%1\r\n+proto\r\n:3\r\n+RESET\r\n');

      await pending;

      assert.strictEqual(requester.database, 0);
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

      assert.ok(error instanceof SolidisRequesterError);
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
      assert.deepStrictEqual(
        [...pubSub.getSubscriptions('subscribe')],
        ['a', 'b'],
      );
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

    it('expands an argument-less UNSUBSCRIBE into the tracked channels', async () => {
      const { connection, pubSub, requester } = createRequester();

      pubSub.dispatchSubscriptionChange('subscribe', ['subscribe', 'a', 1]);
      pubSub.dispatchSubscriptionChange('subscribe', ['subscribe', 'b', 2]);
      pubSub.dispatchSubscriptionChange('psubscribe', ['psubscribe', 'p*', 3]);

      const pending = requester.send([['UNSUBSCRIBE']]);

      await flushed();

      assert.deepStrictEqual(connection.writes, [
        commandsToBuffer([['UNSUBSCRIBE', 'a', 'b']]),
      ]);

      connection.reply(
        subscribeConfirmation('unsubscribe', 'a', 2) +
          subscribeConfirmation('unsubscribe', 'b', 1),
      );

      const [replies] = await pending;

      assert.strictEqual(replies.length, 2);
      assert.strictEqual(pubSub.getSubscriptions('subscribe').size, 0);
      assert.deepStrictEqual(
        [...pubSub.getSubscriptions('psubscribe')],
        ['p*'],
      );
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
        (error: unknown) => error instanceof RespError && error.code === 'ERR',
      );
      assert.deepStrictEqual(await next, [['PONG']]);
    });

    it('logs serialized pipelines with credentials masked', async () => {
      const debugMemory = new SolidisDebugMemory(10);
      const { connection, requester } = createRequester(
        {},
        undefined,
        debugMemory,
      );

      const pending = requester.send([['AUTH', 'user', 'secret'], ['PING']]);

      await flushed();

      connection.reply('+OK\r\n+PONG\r\n');

      await pending;

      const messages = debugMemory.getLogs().map(({ message }) => message);

      assert.deepStrictEqual(messages, [
        `Requester serialized: ${commandsToBuffer([
          ['AUTH', '***', '***'],
          ['PING'],
        ])}`,
        'Requester received 12 bytes',
      ]);
    });
  });
});

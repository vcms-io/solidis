/**
 * Debug infrastructure and requester module internals: debug memory capacity
 * and lifecycle, debug transforms, debug handle generation, requester fault
 * recovery and pipeline chunking, and the DEBUG command itself.
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { after, before, describe, it } from 'node:test';

import {
  RespError,
  SolidisClientError,
  SolidisRequesterError,
} from '../../../../sources/index.ts';
import {
  closeClient,
  createClient,
  createKeyspace,
  waitFor,
} from '../../utils/index.ts';

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

    it('transforms debug log with data field', async () => {
      const { SolidisDebugTransform } = await import(
        '../../../../sources/modules/debug.ts'
      );

      const transform = new SolidisDebugTransform();

      const result = await new Promise<string>((resolve) => {
        transform._transform(
          { type: 'info', message: 'hello', data: { key: 'val' } },
          'utf8',
          (_error, data) => {
            resolve(data ?? '');
          },
        );
      });

      assert.strictEqual(result, '[Solidis info] hello {"key":"val"}\r\n');
    });

    it('transforms debug log without data field', async () => {
      const { SolidisDebugTransform } = await import(
        '../../../../sources/modules/debug.ts'
      );

      const transform = new SolidisDebugTransform();

      const result = await new Promise<string>((resolve) => {
        transform._transform(
          { type: 'error', message: 'fail' },
          'utf8',
          (_error, data) => {
            resolve(data ?? '');
          },
        );
      });

      assert.strictEqual(result, '[Solidis error] fail\r\n');
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
    it('writes and retrieves logs when DEBUG environment variable includes solidis', async () => {
      const originalDebug = process.env.DEBUG;

      process.env.DEBUG = 'solidis';

      try {
        const { SolidisDebugMemory } = await import(
          '../../../../sources/modules/debug.ts'
        );

        const memory = new SolidisDebugMemory(10);

        memory.write({ type: 'info', message: 'env-activated debug' });

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
      const reply = await client.debug('SLEEP', '0');

      if (reply instanceof RespError) {
        assert.strictEqual(
          reply.message,
          'ERR DEBUG command not allowed. If the enable-debug-command option is set to "local", you can run it from a local connection, otherwise you need to set this option in the configuration file, and then restart the server.',
        );
        return;
      }

      assert.strictEqual(reply, 'OK');
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
          error.message === 'Solidis command(s) timed out after 50 ms.',
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

  describe('requester large reply processing chunking', () => {
    it('handles large number of replies exceeding maxProcessRepliesPerChunk', async () => {
      const largeClient = await createClient({
        maxProcessRepliesPerChunk: 5,
      });

      const key = keyspace.key('large-replies');

      await largeClient.set(key, 'base');

      const commands: string[][] = [];

      for (let index = 0; index < 20; index += 1) {
        commands.push(['GET', key]);
      }

      const results = await largeClient.send(commands);

      const expectedValue = Buffer.from('base');

      assert.deepStrictEqual(
        results,
        Array.from({ length: 20 }, () => [expectedValue]),
      );

      await closeClient(largeClient);
    });
  });

  describe('requester recovery from write error', () => {
    it('rejects in-flight pipeline when recovery begins between chunked socket writes', async () => {
      const { SolidisRequester } = await import(
        '../../../../sources/modules/requester.ts'
      );
      const { SolidisPubSub } = await import(
        '../../../../sources/modules/pubsub.ts'
      );
      const { SolidisDefaultOptions } = await import(
        '../../../../sources/common/constants.ts'
      );

      let writeIndex = 0;
      let requester!: InstanceType<typeof SolidisRequester>;
      const emitter = new EventEmitter();

      const originalOnce = emitter.once.bind(emitter);
      const originalRemoveListener = emitter.removeListener.bind(emitter);

      const socket = emitter as import('node:net').Socket;

      socket.write = () => {
        writeIndex += 1;

        if (writeIndex === 2) {
          requester.recoveryFromFault(new Error('mid-write fault'));
        }

        return true;
      };

      socket.once = ((
        event: string,
        listener: (...arguments_: unknown[]) => void,
      ) => {
        originalOnce(event, listener);

        return socket;
      }) as typeof socket.once;

      socket.removeListener = ((
        event: string,
        listener: (...arguments_: unknown[]) => void,
      ) => {
        originalRemoveListener(event, listener);

        return socket;
      }) as typeof socket.removeListener;

      requester = new SolidisRequester({
        ...SolidisDefaultOptions,
        maxSocketWriteSizePerOnce: 16,
        connection: { socket, reset() {} } as never,
        pubSub: new SolidisPubSub(),
        autoReconnect: false,
      });

      const commands = Array.from({ length: 20 }, () => [
        'ECHO',
        'x'.repeat(100),
      ]);

      const sendError = await requester
        .send(commands)
        .then(() => null)
        .catch((error: Error) => error);

      assert.strictEqual(
        sendError?.message,
        'mid-write fault',
        'send must reject with the exact error passed to recoveryFromFault, ' +
          'because #rejectAllRequests propagates it without wrapping',
      );
    });

    it('triggers recoveryFromFault when socket write fails mid-command', async () => {
      const faultClient = await createClient({
        autoReconnect: true,
        maxConnectionRetries: 3,
        connectionRetryDelay: 25,
        connectionTimeout: 500,
      });

      faultClient.on('error', () => {});

      const key = keyspace.key('fault-recovery');
      const blockKey = keyspace.key('fault-block');

      await faultClient.set(key, 'initial');

      const clientId = await faultClient.clientId();

      const killerClient = await createClient();

      const pendingSettled = faultClient
        .blpop([blockKey], 0)
        .then(() => ({ rejected: false, error: undefined as unknown }))
        .catch((error: unknown) => ({ rejected: true, error }));

      await waitFor(
        async () => {
          const list = await killerClient.clientList();
          return list.includes('cmd=blpop');
        },
        {
          timeout: 2000,
          interval: 10,
          description: 'blpop registered on server',
        },
      );

      await killerClient.clientKill(clientId);

      const settlement = await pendingSettled;

      assert.strictEqual(settlement.rejected, true);
      if (!(settlement.error instanceof SolidisClientError)) {
        const constructorName =
          settlement.error instanceof Error
            ? settlement.error.constructor.name
            : String(settlement.error);

        assert.fail(
          'CLIENT KILL must surface a SolidisClientError from the fault recovery path, got: ' +
            constructorName,
        );
      }

      assert.strictEqual(
        settlement.error.message,
        'SolidisConnectionError: Solidis connection closed.',
      );

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
  });

  describe('requester socket close event type safety', () => {
    it('wraps the hadError boolean from socket close into a SolidisRequesterError', async () => {
      const { SolidisRequester } = await import(
        '../../../../sources/modules/requester.ts'
      );
      const { SolidisPubSub } = await import(
        '../../../../sources/modules/pubsub.ts'
      );
      const { SolidisDefaultOptions } = await import(
        '../../../../sources/common/constants.ts'
      );

      const emitter = new EventEmitter();

      const originalOnce = emitter.once.bind(emitter);
      const originalRemoveListener = emitter.removeListener.bind(emitter);

      const socket = emitter as import('node:net').Socket;

      let hasEmittedClose = false;

      socket.write = () => {
        if (!hasEmittedClose) {
          hasEmittedClose = true;

          emitter.emit('close', false);
        }

        return true;
      };

      socket.once = ((
        event: string,
        listener: (...arguments_: unknown[]) => void,
      ) => {
        originalOnce(event, listener);

        return socket;
      }) as typeof socket.once;

      socket.removeListener = ((
        event: string,
        listener: (...arguments_: unknown[]) => void,
      ) => {
        originalRemoveListener(event, listener);

        return socket;
      }) as typeof socket.removeListener;

      const requester = new SolidisRequester({
        ...SolidisDefaultOptions,
        commandTimeout: 500,
        maxSocketWriteSizePerOnce: 65536,
        connection: { socket, reset() {} } as never,
        pubSub: new SolidisPubSub(),
        autoReconnect: false,
      });

      const sendError = await requester
        .send([['PING']])
        .then(() => null)
        .catch((error: Error) => error);

      assert.strictEqual(
        sendError?.message,
        'Socket closed',
        'the socket close event fires with (hadError: boolean) but the ' +
          'requester must wrap this boolean into a SolidisRequesterError ' +
          'and the error handler reference chain must not be broken by a ' +
          'shallow copy so that eventHandlers.isError reflects the update',
      );
    });
  });

  describe('requester scheduled callback cancellation', () => {
    it('calls clearImmediate on scheduled callbacks during fault recovery', async () => {
      const { SolidisRequester } = await import(
        '../../../../sources/modules/requester.ts'
      );
      const { SolidisPubSub } = await import(
        '../../../../sources/modules/pubsub.ts'
      );
      const { SolidisDefaultOptions } = await import(
        '../../../../sources/common/constants.ts'
      );

      const clearedHandles: NodeJS.Immediate[] = [];
      const originalClearImmediate = globalThis.clearImmediate;
      let trackingEnabled = false;

      globalThis.clearImmediate = ((handle: NodeJS.Immediate) => {
        if (trackingEnabled) {
          clearedHandles.push(handle);
        }

        return originalClearImmediate(handle);
      }) as typeof globalThis.clearImmediate;

      try {
        const emitter = new EventEmitter();
        const originalOnce = emitter.once.bind(emitter);
        const originalRemoveListener = emitter.removeListener.bind(emitter);
        const socket = emitter as import('node:net').Socket;

        socket.write = () => true;

        socket.once = ((
          event: string,
          listener: (...arguments_: unknown[]) => void,
        ) => {
          originalOnce(event, listener);

          return socket;
        }) as typeof socket.once;

        socket.removeListener = ((
          event: string,
          listener: (...arguments_: unknown[]) => void,
        ) => {
          originalRemoveListener(event, listener);

          return socket;
        }) as typeof socket.removeListener;

        const requester = new SolidisRequester({
          ...SolidisDefaultOptions,
          maxSocketWriteSizePerOnce: 65536,
          connection: { socket, reset() {} } as never,
          pubSub: new SolidisPubSub(),
          autoReconnect: false,
        });

        const sendPromise = requester.send([['PING']]).catch(() => {});

        trackingEnabled = true;

        requester.recoveryFromFault(new Error('test fault'));

        await sendPromise;
        await new Promise<void>((resolve) => setTimeout(resolve, 100));

        trackingEnabled = false;

        assert.strictEqual(
          clearedHandles.length > 0,
          true,
          'recoveryFromFault must call clearImmediate at least once to ' +
            'cancel scheduled request and reply processing callbacks — ' +
            'currently resetStates only sets the references to undefined ' +
            'without calling clearImmediate, leaving stale callbacks in ' +
            'the event loop after fault recovery resets all internal state',
        );
      } finally {
        globalThis.clearImmediate = originalClearImmediate;
      }
    });
  });
});

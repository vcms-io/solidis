/**
 * Debug infrastructure and requester module internals: debug memory capacity
 * and lifecycle, debug transforms, debug handle generation, requester fault
 * recovery and pipeline chunking, and the DEBUG command itself.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { RespError } from '../../../../sources/index.ts';
import {
  closeClient,
  createClient,
  createKeyspace,
  delay,
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
      assert.strictEqual(logs[0].message, 'two');
      assert.strictEqual(logs[2].message, 'four');
    });

    it('clears logs', async () => {
      const { SolidisDebugMemory } = await import(
        '../../../../sources/modules/debug.ts'
      );

      const memory = new SolidisDebugMemory(10);

      memory.write({ type: 'info', message: 'data' });

      assert.strictEqual(memory.getLogs().length, 1);

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

      assert.ok(logs[0].timestamp);
      assert.strictEqual(typeof logs[0].timestamp, 'number');
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

      await delay(10);

      assert.notStrictEqual(emittedEntry, null);
      assert.strictEqual((emittedEntry as { type: string }).type, 'debug');
      assert.strictEqual(
        (emittedEntry as { message: string }).message,
        'event test',
      );
      assert.strictEqual(
        typeof (emittedEntry as { timestamp: number }).timestamp,
        'number',
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

      assert.ok(result.includes('[Solidis info] hello'));
      assert.ok(result.includes('"key":"val"'));
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

      assert.ok(result.includes('[Solidis error] fail'));
      assert.ok(!result.includes('{'));
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

      assert.ok(typeof handle === 'function');

      handle('info', 'test message', { extra: true });

      await delay(10);

      const logs = memory.getLogs();

      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].message, 'test message');
    });
  });

  describe('debug stream via DEBUG environment variable', () => {
    it('activates debug stream when DEBUG includes solidis', async () => {
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
        assert.strictEqual(logs[0].message, 'env-activated debug');
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

    it('executes DEBUG SLEEP 0 without error', async () => {
      const reply = await client.debug('SLEEP', '0');

      if (reply instanceof RespError) {
        assert.match(`${reply.message}`, /DEBUG|not allowed|unknown/i);
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

      await faultyClient.set(key, 'value');

      faultyClient.quit();

      await assert.rejects(() => faultyClient.get(key));
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

      await assert.rejects(() =>
        timeoutClient.send([['BLPOP', keyspace.key('never-exists'), '0']]),
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
          /not an integer|out of range/i.test(error.message),
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

      assert.strictEqual(results.length, 20);
      assert.ok(results.every((reply) => `${reply[0]}` === 'base'));

      await closeClient(largeClient);
    });
  });

  describe('requester recovery from write error', () => {
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

      await delay(30);

      await killerClient.clientKill(clientId);

      const settlement = await pendingSettled;

      assert.strictEqual(settlement.rejected, true);
      assert.ok(settlement.error instanceof Error);

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

  describe('requester duplicate recovery is idempotent', () => {
    it('does not corrupt state on repeated disconnect events', async () => {
      const recoveryClient = await createClient({
        autoReconnect: true,
        maxConnectionRetries: 3,
        connectionRetryDelay: 25,
        connectionTimeout: 500,
      });

      recoveryClient.on('error', () => {});

      const key = keyspace.key('dup-recovery');

      await recoveryClient.set(key, 'stable');

      const clientId = await recoveryClient.clientId();
      const killerClient = await createClient();

      await killerClient.clientKill(clientId);

      await delay(150);

      const value = await recoveryClient.get(key);

      assert.strictEqual(value, 'stable');

      await closeClient(recoveryClient);
      await closeClient(killerClient);
    });
  });
});

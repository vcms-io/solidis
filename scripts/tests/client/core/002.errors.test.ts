/**
 * Error handling semantics: typed command errors, raw error replies surfaced
 * as RespError values, command timeouts, and the SolidisError hierarchy.
 */

import assert from 'node:assert/strict';
import { errorMonitor } from 'node:events';
import { after, before, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../../sources/client/featured.ts';
import {
  checkReplyIsPubSubEvent,
  findErrorInReplies,
  getPubSubEventName,
  isMessageEventName,
  RespError,
  SolidisClientError,
  SolidisCommandError,
  SolidisConnectionError,
  SolidisError,
  SolidisParserError,
  SolidisRequesterError,
  unwrapSolidisError,
  wrapWithError,
  wrapWithParserError,
  wrapWithSolidisClientError,
  wrapWithSolidisConnectionError,
  wrapWithSolidisRequesterError,
} from '../../../../sources/index.ts';
import {
  buildClientOptions,
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
} from '../../utils/index.ts';

import type { FeaturedClient, ServerCapabilities } from '../../utils/index.ts';

describe('errors', () => {
  let client: FeaturedClient;
  let capabilities: ServerCapabilities;
  const keyspace = createKeyspace('errors');

  before(async () => {
    client = await createClient();
    capabilities = await detectServerCapabilities(client);
  });

  after(async () => {
    await closeClient(client);
  });

  it('throws a typed error for a wrong-type operation', async () => {
    const key = keyspace.key('wrong-type');

    await client.set(key, 'string-value');

    let caught: unknown;

    try {
      await client.lpush(key, 'x');
    } catch (error) {
      caught = error;
    }

    if (!(caught instanceof SolidisCommandError)) {
      assert.fail('expected SolidisCommandError for wrong-type operation');
    }
    assert.strictEqual(
      caught.message,
      '[LPUSH] WRONGTYPE Operation against a key holding the wrong kind of value',
    );

    const cause = caught.cause;

    if (!(cause instanceof RespError)) {
      assert.fail('expected the server RespError as the cause');
    }
    assert.strictEqual(cause.code, 'WRONGTYPE');
    assert.strictEqual(
      cause.message,
      'WRONGTYPE Operation against a key holding the wrong kind of value',
    );
  });

  it('rejects INCR against a non-integer string', async () => {
    const key = keyspace.key('not-integer');

    await client.set(key, 'not-a-number');

    await assert.rejects(
      client.incr(key),
      (error: Error) =>
        error instanceof SolidisCommandError &&
        error.message === '[INCR] ERR value is not an integer or out of range',
    );
  });

  it('surfaces raw error replies as RespError values', async () => {
    const replies = await client.send([['SUBSCRIBE']]);

    if (!(replies[0][0] instanceof RespError)) {
      assert.fail('expected RespError for SUBSCRIBE without arguments');
    }
    assert.strictEqual(
      replies[0][0].message,
      "ERR wrong number of arguments for 'subscribe' command",
    );
  });

  it('isolates errors per command within a pipeline', async () => {
    const key = keyspace.key('pipeline-error');

    const replies = await client.send([
      ['SET', key, 'value'],
      ['INCR', key],
      ['GET', key],
    ]);

    assert.strictEqual(replies[0][0], 'OK');
    if (!(replies[1][0] instanceof RespError)) {
      assert.fail('expected RespError for INCR on non-integer value');
    }
    assert.strictEqual(
      replies[1][0].message,
      'ERR value is not an integer or out of range',
    );
    assert.deepStrictEqual(replies[2][0], Buffer.from('value'));
  });

  it('reports unknown commands as errors', async () => {
    const replies = await client.send([['NOTACOMMAND', 'arg']]);
    const reply = replies[0][0];

    if (!(reply instanceof RespError)) {
      assert.fail('expected RespError for unknown command NOTACOMMAND');
    }
    if (capabilities.atLeast(7, 0)) {
      assert.strictEqual(
        reply.message,
        "ERR unknown command 'NOTACOMMAND', with args beginning with: 'arg' ",
      );
    } else {
      assert.strictEqual(
        reply.message,
        'ERR unknown command `NOTACOMMAND`, with args beginning with: `arg`, ',
      );
    }
  });

  it('times out a blocking command past commandTimeout', async () => {
    const blocking = await createClient({ commandTimeout: 200 });

    try {
      await assert.rejects(
        blocking.send([['BLPOP', keyspace.key('never-pushed'), '0']]),
        (error: Error) =>
          error instanceof SolidisRequesterError &&
          error.message === 'Command(s) timed out after 200 ms.',
      );
    } finally {
      await closeClient(blocking);
    }
  });

  it('wraps connection failures as SolidisConnectionError', async () => {
    const failing = new SolidisFeaturedClient(
      buildClientOptions({
        host: '127.0.0.1',
        port: 1,
        lazyConnect: true,
        maxConnectionRetries: 0,
        connectionTimeout: 200,
      }),
    );

    failing.on('error', () => {});

    let caught: unknown;

    try {
      await failing.connect();
    } catch (error) {
      caught = error;
    }

    if (!(caught instanceof SolidisConnectionError)) {
      assert.fail('expected SolidisConnectionError for connection refusal');
    }
    assert.strictEqual(caught.message, 'Connection failed after 0 retries.');

    const attemptError = caught.cause;

    if (!(attemptError instanceof SolidisConnectionError)) {
      assert.fail('expected the last attempt error as the cause');
    }
    assert.strictEqual(
      attemptError.message,
      'connect ECONNREFUSED 127.0.0.1:1',
    );

    failing.quit();
  });

  it('warns about errors only while nobody listens for them', async (context) => {
    const warnings: unknown[] = [];
    const emitWarning = context.mock.method(
      process,
      'emitWarning',
      (warning: unknown) => {
        warnings.push(warning);
      },
    );
    const createFailing = () =>
      new SolidisFeaturedClient(
        buildClientOptions({
          host: '127.0.0.1',
          port: 1,
          lazyConnect: true,
          maxConnectionRetries: 0,
          connectionTimeout: 200,
        }),
      );

    const unattended = createFailing();

    await assert.rejects(unattended.connect(), SolidisConnectionError);

    assert.strictEqual(emitWarning.mock.callCount(), 1);
    assert.ok(warnings[0] instanceof SolidisConnectionError);
    assert.strictEqual(warnings[0].message, 'connect ECONNREFUSED 127.0.0.1:1');

    const errors: unknown[] = [];
    const attended = createFailing();

    attended.on('error', (error) => {
      errors.push(error);
    });

    await assert.rejects(attended.connect(), SolidisConnectionError);

    assert.strictEqual(emitWarning.mock.callCount(), 1);
    assert.strictEqual(errors.length, 1);

    unattended.quit();
    attended.quit();
  });

  it('keeps warning about errors after every listener was removed', (context) => {
    const warnings: unknown[] = [];
    const monitored: unknown[] = [];
    const handled: unknown[] = [];

    context.mock.method(process, 'emitWarning', (warning: unknown) => {
      warnings.push(warning);
    });

    const client = new SolidisFeaturedClient(
      buildClientOptions({ lazyConnect: true }),
    );
    const [first, second, third] = ['first', 'second', 'third'].map(
      (message) => new Error(message),
    );

    client.addListener(errorMonitor, (error) => monitored.push(error));
    client.on('error', () => {});
    client.removeAllListeners('error');

    assert.strictEqual(client.emit('error', first), false);

    client.removeAllListeners();

    assert.strictEqual(client.emit('error', second), false);

    client.addListener(errorMonitor, (error) => monitored.push(error));
    client.on('error', (error) => handled.push(error));

    assert.strictEqual(client.emit('error', third), true);
    assert.deepStrictEqual(warnings, [first, second]);
    assert.deepStrictEqual(monitored, [first, third]);
    assert.deepStrictEqual(handled, [third]);

    client.quit();
  });

  it('unwraps nested Solidis errors to their root causes', () => {
    const root = new Error('root cause');
    const wrapped = new SolidisClientError('outer failure', root);

    const chain = unwrapSolidisError(wrapped);

    assert.deepStrictEqual(
      chain.map((entry) => entry.message),
      ['outer failure', 'root cause'],
    );
  });

  it('does not produce duplicate entries when unwrapping deeply nested errors', () => {
    const root = new Error('root cause');
    const middle = new SolidisClientError('middle layer', root);
    const outer = new SolidisClientError('outer layer', middle);

    const chain = unwrapSolidisError(outer);

    assert.deepStrictEqual(
      chain.map((entry) => entry.message),
      ['outer layer', 'middle layer', 'root cause'],
    );

    const uniqueMessages = new Set(chain.map((entry) => entry.message));

    assert.strictEqual(
      uniqueMessages.size,
      chain.length,
      'unwrapped chain must not contain duplicate entries',
    );
  });

  it('annotates command errors with the command name', async () => {
    const key = keyspace.key('annotated');

    await client.set(key, 'value');

    let message = '';

    try {
      await client.lpush(key, 'x');
    } catch (error) {
      message = error instanceof Error ? error.message : `${error}`;
    }

    assert.strictEqual(
      message,
      '[LPUSH] WRONGTYPE Operation against a key holding the wrong kind of value',
    );
  });

  it('creates RespError without stack and leaves the stack trace limit as it was', () => {
    const { stackTraceLimit } = Error;

    Error.stackTraceLimit = 7;

    try {
      const error = new RespError('test message');

      assert.ok(error instanceof SolidisError);
      assert.strictEqual(error.name, 'RespError');
      assert.strictEqual(error.message, 'test message');
      assert.strictEqual(error.code, 'test');
      assert.strictEqual(error.stack, undefined);
      assert.strictEqual(Error.stackTraceLimit, 7);
    } finally {
      Error.stackTraceLimit = stackTraceLimit;
    }
  });

  it('captures no stack trace while it creates a RespError', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Error,
      'stackTraceLimit',
    );
    const limits: unknown[] = [];

    Object.defineProperty(Error, 'stackTraceLimit', {
      configurable: true,
      get: () => limits.at(-1) ?? 10,
      set: (limit: unknown) => {
        limits.push(limit);
      },
    });

    try {
      assert.strictEqual(new RespError('ERR captured').code, 'ERR');
    } finally {
      if (descriptor) {
        Object.defineProperty(Error, 'stackTraceLimit', descriptor);
      }
    }

    assert.deepStrictEqual(limits, [0, 10]);
  });

  it('creates SolidisError preserving original error', () => {
    const original = new Error('original');
    const solidisError = new SolidisError('wrapped', original);

    assert.strictEqual(solidisError.name, 'SolidisError');
    assert.strictEqual(solidisError.message, 'wrapped');
    assert.notStrictEqual(solidisError.stack, original.stack);
    assert.match(solidisError.stack ?? '', /^SolidisError: wrapped\n/);
    assert.strictEqual(solidisError.cause, original);
  });

  it('creates SolidisError without original error', () => {
    const solidisError = new SolidisError('no original');

    assert.strictEqual(solidisError.cause, undefined);
  });

  it('wraps non-Error with wrapWithError', () => {
    const wrapped = wrapWithError('string error');

    assert.strictEqual(wrapped.message, 'string error');

    const passthrough = new Error('already error');

    assert.strictEqual(wrapWithError(passthrough), passthrough);
  });

  it('wraps with specialized error wrappers', () => {
    const clientError = new SolidisClientError('existing');

    assert.strictEqual(wrapWithSolidisClientError(clientError), clientError);

    const wrappedClientError = wrapWithSolidisClientError('raw');

    assert.strictEqual(wrappedClientError.message, 'raw');
    assert.strictEqual(wrappedClientError.name, 'SolidisClientError');

    const connectionError = new SolidisConnectionError('existing');

    assert.strictEqual(
      wrapWithSolidisConnectionError(connectionError),
      connectionError,
    );

    const wrappedConnectionError = wrapWithSolidisConnectionError('raw');

    assert.strictEqual(wrappedConnectionError.message, 'raw');
    assert.strictEqual(wrappedConnectionError.name, 'SolidisConnectionError');

    const parserError = new SolidisParserError('existing');

    assert.strictEqual(wrapWithParserError(parserError), parserError);

    const wrappedParserError = wrapWithParserError('raw');

    assert.strictEqual(wrappedParserError.message, 'raw');
    assert.strictEqual(wrappedParserError.name, 'SolidisParserError');

    const requesterError = new SolidisRequesterError('existing');

    assert.strictEqual(
      wrapWithSolidisRequesterError(requesterError),
      requesterError,
    );

    const wrappedRequesterError = wrapWithSolidisRequesterError('raw');

    assert.strictEqual(wrappedRequesterError.message, 'raw');
    assert.strictEqual(wrappedRequesterError.name, 'SolidisRequesterError');
  });

  it('names the attempts of an AggregateError without a message, as connecting to every address of a host gives', async () => {
    const attempts = [
      new Error('connect ECONNREFUSED ::1:1'),
      new Error('connect ECONNREFUSED 127.0.0.1:1'),
    ];
    const aggregate = new AggregateError(attempts);
    const wrapped = wrapWithSolidisConnectionError(aggregate);

    assert.strictEqual(
      wrapped.message,
      'Error: connect ECONNREFUSED ::1:1,Error: connect ECONNREFUSED 127.0.0.1:1',
    );
    assert.strictEqual(wrapped.cause, aggregate);
    assert.strictEqual(
      wrapWithSolidisConnectionError(new AggregateError(attempts, 'all failed'))
        .message,
      'all failed',
    );
    assert.strictEqual(
      wrapWithSolidisConnectionError(new Error('')).message,
      '',
    );

    const failing = new SolidisFeaturedClient(
      buildClientOptions({
        host: 'localhost',
        port: 1,
        lazyConnect: true,
        maxConnectionRetries: 0,
        connectionTimeout: 200,
      }),
    );

    failing.on('error', () => {});

    await assert.rejects(failing.connect(), (error: Error) => {
      assert.ok(error.cause instanceof SolidisConnectionError);
      assert.match(error.cause.message, /ECONNREFUSED/);

      return true;
    });

    failing.quit();
  });

  it('unwraps non-Error value gracefully', () => {
    const result = unwrapSolidisError('not an error');

    assert.deepStrictEqual(result, []);
  });

  it('rejects odd-length arrays in processPairedArray', async () => {
    const { processPairedArray } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => processPairedArray(['key1', 'val1', 'key2'], () => {}),
      (error: Error) =>
        error.message === 'Unexpected reply: expected even-length array, got 3',
    );
  });

  it('does not throw a raw TypeError when a sender returns no replies', async () => {
    const { executeCommand, tryReplyToString } = await import(
      '../../../../sources/command/utils/index.ts'
    );
    const sender = { send: async () => [] };

    assert.strictEqual(await executeCommand(sender, ['GET', 'k']), undefined);
    await assert.rejects(
      executeCommand(sender, ['GET', 'k'], tryReplyToString),
      (error: unknown) =>
        error instanceof SolidisCommandError &&
        error.message === '[GET] Unexpected reply: undefined',
    );
  });

  it('names the event of a Pub/Sub frame of any length', () => {
    assert.strictEqual(getPubSubEventName([Buffer.from('message')]), 'message');
    assert.strictEqual(
      checkReplyIsPubSubEvent([Buffer.from('unsubscribe')]),
      true,
    );
    assert.strictEqual(getPubSubEventName([Buffer.from('get')]), undefined);
  });

  it('finds an error reply at any depth of a reply', () => {
    const error = new RespError('ERR nested');

    assert.strictEqual(findErrorInReplies(error), error);
    assert.strictEqual(findErrorInReplies(['OK', [1, [error]]]), error);
    assert.strictEqual(
      findErrorInReplies(['OK', [1, Buffer.from('x')]]),
      false,
    );
    assert.strictEqual(findErrorInReplies(null), false);
  });

  it('returns false for pubsub event checks with non-buffer event names', () => {
    assert.strictEqual(
      checkReplyIsPubSubEvent([
        'message',
        Buffer.from('ch'),
        Buffer.from('data'),
      ]),
      false,
    );

    assert.strictEqual(
      getPubSubEventName(['message', Buffer.from('ch'), Buffer.from('data')]),
      undefined,
    );
  });

  it('throws on invalid input to tryReplyToBoolean', async () => {
    const { tryReplyToBoolean } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyToBoolean('yes'),
      (error: Error) => error.message === 'Unexpected reply: string',
    );
    assert.throws(
      () => tryReplyToBoolean(42),
      (error: Error) => error.message === 'Unexpected reply: number',
    );
  });

  it('throws on non-array input to tryReplyToBooleanArray', async () => {
    const { tryReplyToBooleanArray } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyToBooleanArray('not-an-array'),
      (error: Error) => error.message === 'Unexpected reply: string',
    );
  });

  it('handles string input and throws on invalid input for tryReplyToBinaryString', async () => {
    const { tryReplyToBinaryString } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.strictEqual(tryReplyToBinaryString('hello'), 'hello');
    assert.throws(
      () => tryReplyToBinaryString(42),
      (error: Error) => error.message === 'Unexpected reply: number',
    );
  });

  it('throws on NaN input to tryReplyToNumber', async () => {
    const { tryReplyToNumber } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyToNumber('not-a-number'),
      (error: Error) => error.message === 'Unexpected reply: string',
    );
    assert.throws(
      () => tryReplyToNumber({}),
      (error: Error) => error.message === 'Unexpected reply: object',
    );
  });

  it('throws on non-array non-Map input to processPairedArray', async () => {
    const { processPairedArray } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => processPairedArray(42, () => {}),
      (error: Error) => error.message === 'Unexpected reply: number',
    );
  });

  it('throws on non-array input to tryReplyArray', async () => {
    const { tryReplyArray } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyArray('not-an-array'),
      (error: Error) => error.message === 'Unexpected reply: string',
    );
    assert.throws(
      () => tryReplyArray(42),
      (error: Error) => error.message === 'Unexpected reply: number',
    );
  });

  it('throws on non-array non-Set input to tryReplyToStringArray', async () => {
    const { tryReplyToStringArray } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyToStringArray(42),
      (error: Error) => error.message === 'Unexpected reply: number',
    );
  });

  it('throws on non-array input to tryReplyToSortedSetMembers', async () => {
    const { tryReplyToSortedSetMembers } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyToSortedSetMembers('bad'),
      (error: Error) => error.message === 'Unexpected reply: string',
    );
  });

  it('throws on non-array input to tryReplyToStringsOrSortedSetMembers', async () => {
    const { tryReplyToStringsOrSortedSetMembers } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyToStringsOrSortedSetMembers('bad', 'ZRANGE', true),
      (error: Error) => error.message === '[ZRANGE] Unexpected reply: string',
    );
  });

  it('throws on malformed BZPOPMIN tuple in tryReplyToKeyMemberScoreOrNull', async () => {
    const { tryReplyToKeyMemberScoreOrNull } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyToKeyMemberScoreOrNull([1, 2, 3], 'BZPOPMIN'),
      (error: Error) => error.message === '[BZPOPMIN] Unexpected reply: number',
    );
  });

  it('returns true for pubsub event checks with buffer event names', () => {
    assert.strictEqual(
      checkReplyIsPubSubEvent([
        Buffer.from('message'),
        Buffer.from('ch'),
        Buffer.from('data'),
      ]),
      true,
    );

    const eventName = getPubSubEventName([
      Buffer.from('message'),
      Buffer.from('ch'),
      Buffer.from('data'),
    ]);

    assert.strictEqual(eventName, 'message');
    assert.strictEqual(isMessageEventName(eventName), true);
  });
});

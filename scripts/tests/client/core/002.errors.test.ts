/**
 * Error handling semantics: typed command errors, raw error replies surfaced
 * as RespError values, command timeouts, and the SolidisError hierarchy.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../../sources/client/featured.ts';
import {
  checkReplyIsMessageEvent,
  checkReplyIsPubSubEvent,
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
      `[LPUSH ${key} x] Invalid reply: RespError: WRONGTYPE Operation against a key holding the wrong kind of value`,
    );
  });

  it('rejects INCR against a non-integer string', async () => {
    const key = keyspace.key('not-integer');

    await client.set(key, 'not-a-number');

    await assert.rejects(
      client.incr(key),
      (error: Error) =>
        error instanceof SolidisCommandError &&
        error.message ===
          `[INCR ${key}] Invalid reply: RespError: ERR value is not an integer or out of range`,
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
          error.message === 'Solidis command(s) timed out after 200 ms.',
      );
    } finally {
      await closeClient(blocking);
    }
  });

  it('wraps connection failures as SolidisClientError', async () => {
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

    if (!(caught instanceof SolidisClientError)) {
      assert.fail('expected SolidisClientError for connection refusal');
    }
    assert.strictEqual(
      caught.message,
      'SolidisConnectionError: Error: connect ECONNREFUSED 127.0.0.1:1',
    );

    failing.quit();
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

  it('does not produce duplicate entries when unwrapping nested errors', () => {
    const root = new Error('root cause');
    const wrapped = new SolidisClientError('outer failure', root);

    const chain = unwrapSolidisError(wrapped);

    assert.deepStrictEqual(
      chain.map((entry) => entry.message),
      ['outer failure', 'root cause'],
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
      `[LPUSH ${key} x] Invalid reply: RespError: WRONGTYPE Operation against a key holding the wrong kind of value`,
    );
  });

  it('creates RespError without stack', () => {
    const error = new RespError('test message');

    assert.strictEqual(error.name, 'RespError');
    assert.strictEqual(error.message, 'test message');
    assert.strictEqual(error.stack, undefined);
  });

  it('creates SolidisError preserving original error', () => {
    const original = new Error('original');
    const solidisError = new SolidisError('wrapped', original);

    assert.strictEqual(solidisError.name, 'SolidisError');
    assert.strictEqual(solidisError.message, 'wrapped');
    assert.strictEqual(solidisError.stack, original.stack);
    assert.strictEqual(solidisError.getOriginalError(), original);
  });

  it('creates SolidisError without original error', () => {
    const solidisError = new SolidisError('no original');

    assert.strictEqual(solidisError.getOriginalError(), undefined);
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
        error.message === 'Invalid reply: expected even-length array, got 3',
    );
  });

  it('does not throw a raw TypeError when escapeReply receives an empty array', async () => {
    const { escapeReply } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.doesNotThrow(() => escapeReply([]));
    assert.strictEqual(escapeReply([]), undefined);
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
      checkReplyIsMessageEvent([
        'message',
        Buffer.from('ch'),
        Buffer.from('data'),
      ]),
      false,
    );
  });

  it('throws on invalid input to tryReplyToBoolean', async () => {
    const { tryReplyToBoolean } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyToBoolean('yes'),
      (error: Error) => error.message === 'Invalid reply: yes',
    );
    assert.throws(
      () => tryReplyToBoolean(42),
      (error: Error) => error.message === 'Invalid reply: 42',
    );
  });

  it('throws on non-array input to tryReplyToBooleanArray', async () => {
    const { tryReplyToBooleanArray } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyToBooleanArray('not-an-array'),
      (error: Error) => error.message === 'Invalid reply: not-an-array',
    );
  });

  it('handles string input and throws on invalid input for tryReplyToBinaryString', async () => {
    const { tryReplyToBinaryString } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.strictEqual(tryReplyToBinaryString('hello'), 'hello');
    assert.throws(
      () => tryReplyToBinaryString(42),
      (error: Error) => error.message === 'Invalid reply: 42',
    );
  });

  it('throws on NaN input to tryReplyToNumber', async () => {
    const { tryReplyToNumber } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyToNumber('not-a-number'),
      (error: Error) => error.message === 'Invalid reply: not-a-number',
    );
    assert.throws(
      () => tryReplyToNumber({}),
      (error: Error) => error.message === 'Invalid reply: [object Object]',
    );
  });

  it('throws on non-array non-Map input to processPairedArray', async () => {
    const { processPairedArray } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => processPairedArray(42, () => {}),
      (error: Error) => error.message === 'Invalid reply: 42',
    );
  });

  it('throws on non-array input to tryReplyArray', async () => {
    const { tryReplyArray } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyArray('not-an-array'),
      (error: Error) => error.message === 'Invalid reply: not-an-array',
    );
    assert.throws(
      () => tryReplyArray(42),
      (error: Error) => error.message === 'Invalid reply: 42',
    );
  });

  it('throws on non-array non-Set input to tryReplyToStringArray', async () => {
    const { tryReplyToStringArray } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyToStringArray(42),
      (error: Error) => error.message === 'Invalid reply: 42',
    );
  });

  it('throws on non-array input to tryReplyToSortedSetMembers', async () => {
    const { tryReplyToSortedSetMembers } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyToSortedSetMembers('bad'),
      (error: Error) => error.message === 'Unexpected reply: bad',
    );
  });

  it('throws on non-array input to tryReplyToStringsOrSortedSetMembers', async () => {
    const { tryReplyToStringsOrSortedSetMembers } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyToStringsOrSortedSetMembers('bad', 'ZRANGE', true),
      (error: Error) => error.message === '[ZRANGE] Unexpected reply: bad',
    );
  });

  it('throws on malformed BZPOPMIN tuple in tryReplyToKeyMemberScoreOrNull', async () => {
    const { tryReplyToKeyMemberScoreOrNull } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(
      () => tryReplyToKeyMemberScoreOrNull([1, 2, 3], 'BZPOPMIN'),
      (error: Error) => error.message === '[BZPOPMIN] Unexpected reply: 1,2,3',
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

    assert.strictEqual(
      checkReplyIsMessageEvent([
        Buffer.from('message'),
        Buffer.from('ch'),
        Buffer.from('data'),
      ]),
      true,
    );
  });
});

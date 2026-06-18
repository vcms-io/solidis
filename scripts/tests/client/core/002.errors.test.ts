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
} from '../../utils/index.ts';

import type { FeaturedClient } from '../../utils/index.ts';

describe('errors', () => {
  let client: FeaturedClient;
  const keyspace = createKeyspace('errors');

  before(async () => {
    client = await createClient();
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

    assert.ok(caught instanceof SolidisCommandError);
    assert.ok(caught instanceof SolidisError);
    assert.match(`${caught.message}`, /WRONGTYPE/i);
  });

  it('rejects INCR against a non-integer string', async () => {
    const key = keyspace.key('not-integer');

    await client.set(key, 'not-a-number');

    await assert.rejects(client.incr(key), /not an integer/i);
  });

  it('surfaces raw error replies as RespError values', async () => {
    const replies = await client.send([['SUBSCRIBE']]);

    assert.ok(replies[0][0] instanceof RespError);
  });

  it('isolates errors per command within a pipeline', async () => {
    const key = keyspace.key('pipeline-error');

    const replies = await client.send([
      ['SET', key, 'value'],
      ['INCR', key],
      ['GET', key],
    ]);

    assert.strictEqual(replies[0][0], 'OK');
    assert.ok(replies[1][0] instanceof RespError);
    assert.strictEqual(`${replies[2][0]}`, 'value');
  });

  it('reports unknown commands as errors', async () => {
    const replies = await client.send([['NOTACOMMAND', 'arg']]);
    const reply = replies[0][0];

    assert.ok(reply instanceof RespError);
    assert.match(`${reply.message}`, /unknown command/i);
  });

  it('times out a blocking command past commandTimeout', async () => {
    const blocking = await createClient({ commandTimeout: 200 });

    try {
      await assert.rejects(
        blocking.send([['BLPOP', keyspace.key('never-pushed'), '0']]),
        (error: Error) =>
          error instanceof SolidisRequesterError &&
          /timed out/i.test(error.message),
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

    assert.ok(caught instanceof SolidisClientError);

    failing.quit();
  });

  it('unwraps nested Solidis errors to their root causes', () => {
    const root = new Error('root cause');
    const wrapped = new SolidisClientError('outer failure', root);

    const chain = unwrapSolidisError(wrapped);

    assert.ok(chain.length >= 2);
    assert.strictEqual(
      chain.some((error) => error.message === 'root cause'),
      true,
    );
  });

  it('does not produce duplicate entries when unwrapping nested errors', () => {
    const root = new Error('root cause');
    const wrapped = new SolidisClientError('outer failure', root);

    const chain = unwrapSolidisError(wrapped);
    const unique = new Set(chain);

    assert.strictEqual(
      chain.length,
      unique.size,
      `expected ${unique.size} unique errors but got ${chain.length} (duplicates present)`,
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

    assert.match(message, /LPUSH/);
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

    assert.ok(wrapped instanceof Error);
    assert.strictEqual(wrapped.message, 'string error');

    const passthrough = new Error('already error');

    assert.strictEqual(wrapWithError(passthrough), passthrough);
  });

  it('wraps with specialized error wrappers', () => {
    const clientError = new SolidisClientError('existing');

    assert.strictEqual(wrapWithSolidisClientError(clientError), clientError);
    assert.ok(wrapWithSolidisClientError('raw') instanceof SolidisClientError);

    const connectionError = new SolidisConnectionError('existing');

    assert.strictEqual(
      wrapWithSolidisConnectionError(connectionError),
      connectionError,
    );
    assert.ok(
      wrapWithSolidisConnectionError('raw') instanceof SolidisConnectionError,
    );

    const parserError = new SolidisParserError('existing');

    assert.strictEqual(wrapWithParserError(parserError), parserError);
    assert.ok(wrapWithParserError('raw') instanceof SolidisParserError);

    const requesterError = new SolidisRequesterError('existing');

    assert.strictEqual(
      wrapWithSolidisRequesterError(requesterError),
      requesterError,
    );
    assert.ok(
      wrapWithSolidisRequesterError('raw') instanceof SolidisRequesterError,
    );
  });

  it('unwraps non-Error value gracefully', () => {
    const result = unwrapSolidisError('not an error');

    assert.deepStrictEqual(result, []);
  });

  it('rejects odd-length arrays in processPairedArray', async () => {
    const { processPairedArray } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(() => processPairedArray(['key1', 'val1', 'key2'], () => {}));
  });

  it('does not throw a raw TypeError when escapeReply receives an empty array', async () => {
    const { escapeReply } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.doesNotThrow(() => escapeReply([]));
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

    assert.throws(() => tryReplyToBoolean('yes'));
    assert.throws(() => tryReplyToBoolean(42));
  });

  it('throws on non-array input to tryReplyToBooleanArray', async () => {
    const { tryReplyToBooleanArray } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(() => tryReplyToBooleanArray('not-an-array'));
  });

  it('handles string input and throws on invalid input for tryReplyToBinaryString', async () => {
    const { tryReplyToBinaryString } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.strictEqual(tryReplyToBinaryString('hello'), 'hello');
    assert.throws(() => tryReplyToBinaryString(42));
  });

  it('throws on NaN input to tryReplyToNumber', async () => {
    const { tryReplyToNumber } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(() => tryReplyToNumber('not-a-number'));
    assert.throws(() => tryReplyToNumber({}));
  });

  it('throws on non-array non-Map input to processPairedArray', async () => {
    const { processPairedArray } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(() => processPairedArray(42, () => {}));
  });

  it('throws on non-array input to tryReplyArray', async () => {
    const { tryReplyArray } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(() => tryReplyArray('not-an-array'));
    assert.throws(() => tryReplyArray(42));
  });

  it('throws on non-array non-Set input to tryReplyToStringArray', async () => {
    const { tryReplyToStringArray } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(() => tryReplyToStringArray(42));
  });

  it('throws on non-array input to tryReplyToSortedSetMembers', async () => {
    const { tryReplyToSortedSetMembers } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(() => tryReplyToSortedSetMembers('bad'));
  });

  it('throws on non-array input to tryReplyToStringsOrSortedSetMembers', async () => {
    const { tryReplyToStringsOrSortedSetMembers } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(() =>
      tryReplyToStringsOrSortedSetMembers('bad', 'ZRANGE', true),
    );
  });

  it('throws on malformed BZPOPMIN tuple in tryReplyToKeyMemberScoreOrNull', async () => {
    const { tryReplyToKeyMemberScoreOrNull } = await import(
      '../../../../sources/command/utils/reply.ts'
    );

    assert.throws(() => tryReplyToKeyMemberScoreOrNull([1, 2, 3], 'BZPOPMIN'));
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

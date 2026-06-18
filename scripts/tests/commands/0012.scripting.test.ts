/** Lua scripting: EVAL/EVAL_RO, SCRIPT LOAD/EVALSHA, SCRIPT EXISTS. */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { RespError, SolidisCommandError } from '../../../sources/index.ts';
import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('scripting', () => {
  let client: FeaturedClient;
  let atLeast7 = false;
  const keyspace = createKeyspace('scripting');

  before(async () => {
    client = await createClient();
    atLeast7 = (await detectServerCapabilities(client)).atLeast(7, 0);
  });

  after(async () => {
    await closeClient(client);
  });

  it('evaluates a script returning an integer', async () => {
    assert.strictEqual(await client.eval('return 1 + 1', [], []), 2);
  });

  it('passes keys and arguments to a script', async () => {
    const key = keyspace.key('argv');

    const result = await client.eval(
      'return {KEYS[1], ARGV[1], ARGV[2]}',
      [key],
      ['first', 'second'],
    );

    if (!Array.isArray(result)) {
      assert.fail('expected eval to return an array');
    }

    assert.deepStrictEqual(
      result.map((item) => `${item}`),
      [key, 'first', 'second'],
    );
  });

  it('mutates state through redis.call', async () => {
    const key = keyspace.key('call');

    await client.eval(
      "redis.call('SET', KEYS[1], ARGV[1])",
      [key],
      ['scripted'],
    );

    assert.strictEqual(await client.get(key), 'scripted');
  });

  it('loads and executes a cached script with EVALSHA', async () => {
    const script = "return redis.call('INCR', KEYS[1])";
    const key = keyspace.key('evalsha');
    const expectedSha1 = createHash('sha1').update(script).digest('hex');

    const sha1 = await client.scriptLoad(script);

    assert.strictEqual(sha1, expectedSha1);
    assert.strictEqual(await client.evalsha(sha1, [key], []), 1);
    assert.strictEqual(await client.evalsha(sha1, [key], []), 2);
  });

  it('reports cached script existence with SCRIPT EXISTS', async () => {
    const sha1 = await client.scriptLoad('return 42');
    const absent = '0'.repeat(40);

    assert.deepStrictEqual(await client.scriptExists([sha1, absent]), [1, 0]);
  });

  it('surfaces a NOSCRIPT error for an unknown EVALSHA', async () => {
    /**
     * EVAL/EVALSHA pass the raw reply through without a type guard, so a
     * server error arrives as a RespError value rather than a thrown
     * exception.
     */
    const result = await client.evalsha('0'.repeat(40), [], []);

    assert.ok(result instanceof RespError);
    assert.strictEqual(
      result.message,
      'NOSCRIPT No matching script. Please use EVAL.',
    );
  });

  it('reads with EVAL_RO', async (context) => {
    /** EVAL_RO was introduced in Redis 7.0. */
    if (!atLeast7) {
      context.skip('EVAL_RO requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('readonly');

    await client.set(key, 'value');

    const result = await client.evalRo(
      "return redis.call('GET', KEYS[1])",
      [key],
      [],
    );

    assert.strictEqual(`${result}`, 'value');
  });

  it('reads with EVALSHA_RO', async (context) => {
    if (!atLeast7) {
      context.skip('EVALSHA_RO requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('evalsha-ro');

    await client.set(key, 'frozen');

    const script = "return redis.call('GET', KEYS[1])";
    const sha1 = await client.scriptLoad(script);
    const result = await client.evalshaRo(sha1, [key], []);

    assert.strictEqual(`${result}`, 'frozen');
  });

  it('flushes the script cache with SCRIPT FLUSH', async () => {
    const sha1 = await client.scriptLoad('return 1');

    assert.deepStrictEqual(await client.scriptExists([sha1]), [1]);
    assert.strictEqual(await client.scriptFlush(), 'OK');
    assert.deepStrictEqual(await client.scriptExists([sha1]), [0]);
  });

  it('flushes with SCRIPT FLUSH SYNC', async () => {
    const sha1 = await client.scriptLoad('return 1');

    assert.strictEqual(await client.scriptFlush({ sync: true }), 'OK');
    assert.deepStrictEqual(await client.scriptExists([sha1]), [0]);
  });

  it('flushes with SCRIPT FLUSH ASYNC', async () => {
    const sha1 = await client.scriptLoad('return 1');

    assert.strictEqual(await client.scriptFlush({ async: true }), 'OK');
    assert.deepStrictEqual(await client.scriptExists([sha1]), [0]);
  });

  it('kills a running script with SCRIPT KILL (error when none running)', async () => {
    const result = await client.scriptKill().catch((error: unknown) => error);

    assert.ok(result instanceof SolidisCommandError);
    assert.strictEqual(
      result.message,
      '[SCRIPT KILL] Invalid reply: RespError: NOTBUSY No scripts in execution right now.',
    );
  });
});

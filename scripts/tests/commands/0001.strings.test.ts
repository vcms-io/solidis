/**
 * String value type: SET/GET family, counters, ranged access, and the various
 * SET option permutations (expiry, existence guards, GET-on-set).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
  waitFor,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('strings', () => {
  let client: FeaturedClient;
  let atLeastRedis84 = false;
  let supportsSetIfEq = false;
  let supportsSetIfNe = false;
  const keyspace = createKeyspace('strings');
  const helloWorldDigest = 'b6acb9d84a38ff74';
  const zeroDigest = '0'.repeat(16);

  before(async () => {
    client = await createClient();

    const capabilities = await detectServerCapabilities(client);

    atLeastRedis84 = !capabilities.isValkey && capabilities.atLeast(8, 4);
    supportsSetIfEq = capabilities.isValkey
      ? capabilities.atLeast(8, 1)
      : capabilities.atLeast(8, 4);
    supportsSetIfNe = capabilities.isValkey
      ? capabilities.atLeast(9, 2)
      : capabilities.atLeast(8, 4);
  });

  after(async () => {
    await closeClient(client);
  });

  it('sets and gets a simple value', async () => {
    const key = keyspace.key('simple');

    assert.strictEqual(await client.set(key, 'hello'), 'OK');
    assert.strictEqual(await client.get(key), 'hello');
  });

  it('returns null for a missing key', async () => {
    assert.strictEqual(await client.get(keyspace.key('missing')), null);
  });

  it('reads raw bytes through getBuffer', async () => {
    const key = keyspace.key('buffer');

    await client.set(key, 'raw-bytes');

    const value = await client.getBuffer(key);

    assert.deepStrictEqual(value, Buffer.from('raw-bytes'));
  });

  it('appends and reports the resulting length', async () => {
    const key = keyspace.key('append');

    assert.strictEqual(await client.append(key, 'foo'), 3);
    assert.strictEqual(await client.append(key, 'bar'), 6);
    assert.strictEqual(await client.get(key), 'foobar');
    assert.strictEqual(await client.strlen(key), 6);
  });

  it('supports GETRANGE and SETRANGE', async () => {
    const key = keyspace.key('range');

    await client.set(key, 'Hello World');

    assert.strictEqual(await client.getrange(key, 0, 4), 'Hello');
    assert.strictEqual(await client.getrange(key, -5, -1), 'World');

    await client.setrange(key, 6, 'Redis');

    assert.strictEqual(await client.get(key), 'Hello Redis');
  });

  it('increments and decrements integer counters', async () => {
    const key = keyspace.key('counter');

    assert.strictEqual(await client.incr(key), 1);
    assert.strictEqual(await client.incrby(key, 9), 10);
    assert.strictEqual(await client.decr(key), 9);
    assert.strictEqual(await client.decrby(key, 4), 5);
  });

  it('increments floating point counters precisely', async () => {
    const key = keyspace.key('float');

    assert.strictEqual(await client.incrbyfloat(key, 3.0), 3);
    assert.strictEqual(await client.incrbyfloat(key, 0.1), 3.1);
    assert.strictEqual(await client.incrbyfloat(key, -1.1), 2);
  });

  it('rejects INCR on a non-integer value', async () => {
    const key = keyspace.key('not-a-number');

    await client.set(key, 'abc');

    await assert.rejects(
      () => client.incr(key),
      (error: Error) => {
        assert.strictEqual(
          error.message,
          '[INCR] ERR value is not an integer or out of range',
        );
        return true;
      },
    );
  });

  it('handles MSET and MGET together', async () => {
    const first = keyspace.key('m', 1);
    const second = keyspace.key('m', 2);
    const third = keyspace.key('m', 3);

    assert.strictEqual(
      await client.mset({ [first]: 'a1', [second]: 'a2', [third]: 'a3' }),
      'OK',
    );

    assert.deepStrictEqual(await client.mget(first, second, third), [
      'a1',
      'a2',
      'a3',
    ]);
    assert.deepStrictEqual(await client.mget(first, keyspace.key('absent')), [
      'a1',
      null,
    ]);
  });

  it('honours MSETNX atomicity', async () => {
    const present = keyspace.key('msetnx', 'present');
    const fresh = keyspace.key('msetnx', 'fresh');

    await client.set(present, 'existing');

    assert.strictEqual(
      await client.msetnx({ [present]: 'x', [fresh]: 'y' }),
      0,
    );
    assert.strictEqual(await client.get(fresh), null);

    const onlyFresh = keyspace.key('msetnx', 'only-fresh');

    assert.strictEqual(await client.msetnx({ [onlyFresh]: 'z' }), 1);
    assert.strictEqual(await client.get(onlyFresh), 'z');
  });

  it('applies SETEX / PSETEX expirations', async () => {
    const secondsKey = keyspace.key('setex');
    const millisKey = keyspace.key('psetex');

    assert.strictEqual(await client.setex(secondsKey, 100, 'value'), 'OK');
    const secondsTtl = await client.ttl(secondsKey);
    assert.ok(secondsTtl >= 99 && secondsTtl <= 100);
    assert.strictEqual(await client.get(secondsKey), 'value');

    assert.strictEqual(await client.psetex(millisKey, 100000, 'value'), 'OK');
    const millisPttl = await client.pttl(millisKey);
    assert.ok(millisPttl >= 99000 && millisPttl <= 100000);
    assert.strictEqual(await client.get(millisKey), 'value');
  });

  it('respects SETNX semantics', async () => {
    const key = keyspace.key('setnx');

    assert.strictEqual(await client.setnx(key, 'first'), 1);
    assert.strictEqual(await client.setnx(key, 'second'), 0);
    assert.strictEqual(await client.get(key), 'first');
  });

  it('reads and clears with GETDEL', async () => {
    const key = keyspace.key('getdel');

    await client.set(key, 'temporary');

    assert.strictEqual(await client.getdel(key), 'temporary');
    assert.strictEqual(await client.get(key), null);
  });

  it('refreshes and clears TTL with GETEX', async () => {
    const key = keyspace.key('getex');

    await client.set(key, 'value');

    assert.strictEqual(
      await client.getex(key, { expireInSeconds: 100 }),
      'value',
    );
    const getexSecondsTtl = await client.ttl(key);
    assert.ok(getexSecondsTtl >= 99 && getexSecondsTtl <= 100);

    assert.strictEqual(
      await client.getex(key, { expireInMilliseconds: 50000 }),
      'value',
    );
    const getexMillisPttl = await client.pttl(key);
    assert.ok(getexMillisPttl >= 49000 && getexMillisPttl <= 50000);

    const futureSeconds = Math.floor(Date.now() / 1000) + 3600;

    assert.strictEqual(
      await client.getex(key, { expireAtSeconds: futureSeconds }),
      'value',
    );
    const getexFutureSecondsTtl = await client.ttl(key);
    assert.ok(getexFutureSecondsTtl > 3590 && getexFutureSecondsTtl <= 3600);

    const futureMilliseconds = Date.now() + 7200000;

    assert.strictEqual(
      await client.getex(key, { expireAtMilliseconds: futureMilliseconds }),
      'value',
    );
    const getexFutureMillisPttl = await client.pttl(key);
    assert.ok(
      getexFutureMillisPttl > 7190000 && getexFutureMillisPttl <= 7201000,
    );

    assert.strictEqual(await client.getex(key, { persist: true }), 'value');
    assert.strictEqual(await client.ttl(key), -1);
  });

  it('SET with expireInSeconds option sets a TTL', async () => {
    const key = keyspace.key('set-ex-option');

    assert.strictEqual(
      await client.set(key, 'value', { expireInSeconds: 100 }),
      'OK',
    );
    const setExOptionTtl = await client.ttl(key);
    assert.ok(setExOptionTtl >= 99 && setExOptionTtl <= 100);
    assert.strictEqual(await client.get(key), 'value');
  });

  it('SET honours setIfKeyNotExists / setIfKeyExists guards', async () => {
    const key = keyspace.key('set-guards');

    assert.strictEqual(
      await client.set(key, 'initial', { setIfKeyExists: true }),
      null,
    );
    assert.strictEqual(
      await client.set(key, 'initial', { setIfKeyNotExists: true }),
      'OK',
    );
    assert.strictEqual(
      await client.set(key, 'updated', { setIfKeyNotExists: true }),
      null,
    );
    assert.strictEqual(
      await client.set(key, 'updated', { setIfKeyExists: true }),
      'OK',
    );
    assert.strictEqual(await client.get(key), 'updated');
  });

  it('SET returnOldValue yields the previous value', async () => {
    const key = keyspace.key('set-get');

    await client.set(key, 'old');

    assert.strictEqual(
      await client.set(key, 'new', { returnOldValue: true }),
      'old',
    );
    assert.strictEqual(await client.get(key), 'new');
  });

  it('SET returnOldValueAsBuffer yields a Buffer', async () => {
    const key = keyspace.key('set-get-buffer');

    await client.set(key, 'old');

    const previous = await client.set(key, 'new', {
      returnOldValue: true,
      returnOldValueAsBuffer: true,
    });

    assert.deepStrictEqual(previous, Buffer.from('old'));
  });

  it('SET keepOriginalTimeToLive preserves the TTL', async () => {
    const key = keyspace.key('set-keepttl');

    await client.set(key, 'value', { expireInSeconds: 100 });
    await client.set(key, 'changed', { keepOriginalTimeToLive: true });

    assert.strictEqual(await client.get(key), 'changed');
    const keepTtlValue = await client.ttl(key);
    assert.ok(keepTtlValue >= 99 && keepTtlValue <= 100);
  });

  it('SET with expireInMilliseconds expires the key', async () => {
    const key = keyspace.key('set-px');

    await client.set(key, 'value', { expireInMilliseconds: 60 });

    assert.strictEqual(await client.get(key), 'value');

    await waitFor(async () => (await client.get(key)) === null, {
      timeout: 2000,
      interval: 20,
      description: 'key expired',
    });
  });

  it('SET setIfValueEquals guards on the current value', async (context) => {
    if (!supportsSetIfEq) {
      context.skip('SET IFEQ requires Redis 8.4+ or Valkey 8.1+');
      return;
    }

    const key = keyspace.key('set-ifeq');

    assert.strictEqual(
      await client.set(key, 'a', { setIfValueEquals: 'x' }),
      null,
    );
    assert.strictEqual(await client.get(key), null);

    await client.set(key, 'a');

    assert.strictEqual(
      await client.set(key, 'b', { setIfValueEquals: 'x' }),
      null,
    );
    assert.strictEqual(await client.get(key), 'a');
    assert.strictEqual(
      await client.set(key, 'b', { setIfValueEquals: 'a' }),
      'OK',
    );
    assert.strictEqual(await client.get(key), 'b');
  });

  it('SET setIfValueEquals only touches the TTL on a match', async (context) => {
    if (!supportsSetIfEq) {
      context.skip('SET IFEQ requires Redis 8.4+ or Valkey 8.1+');
      return;
    }

    const key = keyspace.key('set-ifeq-ttl');

    await client.set(key, 'a', { expireInSeconds: 100 });

    assert.strictEqual(
      await client.set(key, 'b', {
        setIfValueEquals: 'x',
        expireInSeconds: 200,
      }),
      null,
    );
    const mismatchTtl = await client.ttl(key);
    assert.ok(mismatchTtl >= 99 && mismatchTtl <= 100);

    assert.strictEqual(
      await client.set(key, 'b', {
        setIfValueEquals: 'a',
        expireInSeconds: 200,
      }),
      'OK',
    );
    const matchTtl = await client.ttl(key);
    assert.ok(matchTtl >= 199 && matchTtl <= 200);

    assert.strictEqual(
      await client.set(key, 'c', { setIfValueEquals: 'b' }),
      'OK',
    );
    assert.strictEqual(await client.ttl(key), -1);
  });

  it('SET setIfValueEquals compares Buffers byte for byte', async (context) => {
    if (!supportsSetIfEq) {
      context.skip('SET IFEQ requires Redis 8.4+ or Valkey 8.1+');
      return;
    }

    const key = keyspace.key('set-ifeq-binary');
    const payload = Buffer.from([0x00, 0xff, 0x10, 0x7f, 0x80]);

    await client.set(key, payload);

    assert.strictEqual(
      await client.set(key, 'text', { setIfValueEquals: payload.toString() }),
      null,
    );
    assert.strictEqual(
      await client.set(key, 'text', { setIfValueEquals: payload }),
      'OK',
    );
    assert.strictEqual(await client.get(key), 'text');
  });

  it('SET setIfValueEquals with returnOldValue yields the previous value either way', async (context) => {
    if (!supportsSetIfEq) {
      context.skip('SET IFEQ requires Redis 8.4+ or Valkey 8.1+');
      return;
    }

    const key = keyspace.key('set-ifeq-get');

    await client.set(key, 'a');

    assert.strictEqual(
      await client.set(key, 'b', {
        setIfValueEquals: 'x',
        returnOldValue: true,
      }),
      'a',
    );
    assert.strictEqual(await client.get(key), 'a');
    assert.strictEqual(
      await client.set(key, 'b', {
        setIfValueEquals: 'a',
        returnOldValue: true,
      }),
      'a',
    );
    assert.strictEqual(await client.get(key), 'b');
  });

  it('rejects SET setIfValueEquals on a non-string key', async (context) => {
    if (!supportsSetIfEq) {
      context.skip('SET IFEQ requires Redis 8.4+ or Valkey 8.1+');
      return;
    }

    const key = keyspace.key('set-ifeq-wrongtype');

    await client.rpush(key, 'item');

    await assert.rejects(
      () => client.set(key, 'value', { setIfValueEquals: 'item' }),
      (error: Error) => {
        assert.strictEqual(
          error.message,
          '[SET] WRONGTYPE Operation against a key holding the wrong kind of value',
        );
        return true;
      },
    );
  });

  it('SET setIfValueNotEquals guards on the current value and creates missing keys', async (context) => {
    if (!supportsSetIfNe) {
      context.skip('SET IFNE requires Redis 8.4+ or Valkey 9.2+');
      return;
    }

    const key = keyspace.key('set-ifne');

    await client.set(key, 'b');

    assert.strictEqual(
      await client.set(key, 'c', { setIfValueNotEquals: 'b' }),
      null,
    );
    assert.strictEqual(await client.get(key), 'b');
    assert.strictEqual(
      await client.set(key, 'c', { setIfValueNotEquals: 'x' }),
      'OK',
    );
    assert.strictEqual(await client.get(key), 'c');

    const fresh = keyspace.key('set-ifne-create');

    assert.strictEqual(
      await client.set(fresh, 'created', { setIfValueNotEquals: 'anything' }),
      'OK',
    );
    assert.strictEqual(await client.get(fresh), 'created');
  });

  it('SET honours setIfDigestEquals / setIfDigestNotEquals guards', async (context) => {
    if (!atLeastRedis84) {
      context.skip('SET IFDEQ / IFDNE require Redis 8.4+');
      return;
    }

    const key = keyspace.key('set-ifdeq-ifdne');

    assert.strictEqual(
      await client.set(key, 'Hello world', { setIfDigestEquals: zeroDigest }),
      null,
    );
    assert.strictEqual(await client.get(key), null);
    assert.strictEqual(
      await client.set(key, 'Hello world', {
        setIfDigestNotEquals: zeroDigest,
      }),
      'OK',
    );

    assert.strictEqual(
      await client.set(key, 'next', { setIfDigestNotEquals: helloWorldDigest }),
      null,
    );
    assert.strictEqual(
      await client.set(key, 'next', { setIfDigestEquals: zeroDigest }),
      null,
    );
    assert.strictEqual(await client.get(key), 'Hello world');

    assert.strictEqual(
      await client.set(key, 'next', { setIfDigestEquals: helloWorldDigest }),
      'OK',
    );
    assert.strictEqual(await client.get(key), 'next');
    assert.strictEqual(
      await client.set(key, 'Hello world', {
        setIfDigestNotEquals: helloWorldDigest,
      }),
      'OK',
    );
    assert.strictEqual(await client.get(key), 'Hello world');
  });

  it('SET setIfDigestEquals with returnOldValue yields the previous value either way', async (context) => {
    if (!atLeastRedis84) {
      context.skip('SET IFDEQ requires Redis 8.4+');
      return;
    }

    const key = keyspace.key('set-ifdeq-get');

    await client.set(key, 'Hello world');

    assert.strictEqual(
      await client.set(key, 'skipped', {
        setIfDigestEquals: zeroDigest,
        returnOldValue: true,
      }),
      'Hello world',
    );
    assert.strictEqual(await client.get(key), 'Hello world');
    assert.strictEqual(
      await client.set(key, 'written', {
        setIfDigestEquals: helloWorldDigest,
        returnOldValue: true,
      }),
      'Hello world',
    );
    assert.strictEqual(await client.get(key), 'written');
  });

  it('hashes a string value with DIGEST', async (context) => {
    if (!atLeastRedis84) {
      context.skip('DIGEST requires Redis 8.4+');
      return;
    }

    const key = keyspace.key('digest');

    assert.strictEqual(await client.digest(key), null);

    await client.set(key, 'Hello world');

    assert.strictEqual(await client.digest(key), helloWorldDigest);
  });

  it('deletes conditionally with DELEX', async (context) => {
    if (!atLeastRedis84) {
      context.skip('DELEX requires Redis 8.4+');
      return;
    }

    const key = keyspace.key('delex');

    await client.set(key, 'Hello world');

    assert.strictEqual(await client.delex(key), 1);
    assert.strictEqual(await client.delex(key), 0);

    await client.set(key, 'Hello world');

    assert.strictEqual(await client.delex(key, { ifValueEquals: 'other' }), 0);
    assert.strictEqual(
      await client.delex(key, { ifValueNotEquals: 'Hello world' }),
      0,
    );
    assert.strictEqual(
      await client.delex(key, { ifDigestEquals: zeroDigest }),
      0,
    );
    assert.strictEqual(
      await client.delex(key, { ifDigestNotEquals: helloWorldDigest }),
      0,
    );
    assert.strictEqual(await client.get(key), 'Hello world');
    assert.strictEqual(
      await client.delex(key, { ifValueEquals: 'Hello world' }),
      1,
    );

    await client.set(key, 'Hello world');

    assert.strictEqual(
      await client.delex(key, { ifValueNotEquals: 'other' }),
      1,
    );

    await client.set(key, 'Hello world');

    assert.strictEqual(
      await client.delex(key, { ifDigestEquals: helloWorldDigest }),
      1,
    );

    await client.set(key, 'Hello world');

    assert.strictEqual(
      await client.delex(key, { ifDigestNotEquals: zeroDigest }),
      1,
    );
    assert.strictEqual(await client.get(key), null);
  });

  it('compares Buffers byte for byte with DELEX', async (context) => {
    if (!atLeastRedis84) {
      context.skip('DELEX requires Redis 8.4+');
      return;
    }

    const key = keyspace.key('delex-binary');
    const payload = Buffer.from([0x00, 0xff, 0x10, 0x7f, 0x80]);

    await client.set(key, payload);

    assert.strictEqual(
      await client.delex(key, { ifValueEquals: payload.toString() }),
      0,
    );
    assert.strictEqual(await client.delex(key, { ifValueEquals: payload }), 1);
  });

  it('rejects DIGEST and conditional DELEX on a non-string key', async (context) => {
    if (!atLeastRedis84) {
      context.skip('DIGEST / DELEX require Redis 8.4+');
      return;
    }

    const key = keyspace.key('digest-delex-wrongtype');

    await client.rpush(key, 'item');

    await assert.rejects(
      () => client.digest(key),
      (error: Error) => {
        assert.strictEqual(
          error.message,
          '[DIGEST] WRONGTYPE Operation against a key holding the wrong kind of value',
        );
        return true;
      },
    );
    await assert.rejects(
      () => client.delex(key, { ifValueEquals: 'item' }),
      (error: Error) => {
        assert.strictEqual(
          error.message,
          '[DELEX] ERR Key should be of string type if conditions are specified',
        );
        return true;
      },
    );
    assert.strictEqual(await client.delex(key), 1);
  });

  it('preserves binary payloads round-trip', async () => {
    const key = keyspace.key('binary');
    const payload = Buffer.from([0x00, 0xff, 0x10, 0x7f, 0x80]);

    await client.set(key, payload);

    const value = await client.getBuffer(key);

    assert.deepStrictEqual(value, payload);
  });

  it('builds SET with EXAT option', async () => {
    const { buildSetCommand } = await import(
      '../../../sources/command/utils/command.ts'
    );

    const command = buildSetCommand('key', 'val', {
      expireAtSeconds: 9999999999,
    });

    assert.deepStrictEqual(command, [
      'SET',
      'key',
      'val',
      'EXAT',
      '9999999999',
    ]);
  });

  it('builds SET with PXAT option', async () => {
    const { buildSetCommand } = await import(
      '../../../sources/command/utils/command.ts'
    );

    const command = buildSetCommand('key', 'val', {
      expireAtMilliseconds: 9999999999999,
    });

    assert.deepStrictEqual(command, [
      'SET',
      'key',
      'val',
      'PXAT',
      '9999999999999',
    ]);
  });

  it('builds SET with KEEPTTL and GET options', async () => {
    const { buildSetCommand } = await import(
      '../../../sources/command/utils/command.ts'
    );

    const command = buildSetCommand('key', 'val', {
      keepOriginalTimeToLive: true,
      returnOldValue: true,
    });

    assert.deepStrictEqual(command, ['SET', 'key', 'val', 'KEEPTTL', 'GET']);
  });

  it('builds SET with IFEQ and GET options', async () => {
    const { buildSetCommand } = await import(
      '../../../sources/command/utils/command.ts'
    );

    const command = buildSetCommand('key', 'val', {
      setIfValueEquals: 'old',
      returnOldValue: true,
    });

    assert.deepStrictEqual(command, [
      'SET',
      'key',
      'val',
      'IFEQ',
      'old',
      'GET',
    ]);
  });

  it('builds SET with IFNE option', async () => {
    const { buildSetCommand } = await import(
      '../../../sources/command/utils/command.ts'
    );

    const command = buildSetCommand('key', 'val', {
      setIfValueNotEquals: 'old',
    });

    assert.deepStrictEqual(command, ['SET', 'key', 'val', 'IFNE', 'old']);
  });

  it('builds SET with IFDEQ option', async () => {
    const { buildSetCommand } = await import(
      '../../../sources/command/utils/command.ts'
    );

    const command = buildSetCommand('key', 'val', {
      setIfDigestEquals: helloWorldDigest,
    });

    assert.deepStrictEqual(command, [
      'SET',
      'key',
      'val',
      'IFDEQ',
      helloWorldDigest,
    ]);
  });

  it('builds SET with IFDNE option', async () => {
    const { buildSetCommand } = await import(
      '../../../sources/command/utils/command.ts'
    );

    const command = buildSetCommand('key', 'val', {
      setIfDigestNotEquals: helloWorldDigest,
    });

    assert.deepStrictEqual(command, [
      'SET',
      'key',
      'val',
      'IFDNE',
      helloWorldDigest,
    ]);
  });

  it('builds DELEX without a condition', async () => {
    const { createCommand } = await import('../../../sources/command/delex.ts');

    const command = createCommand('key');

    assert.deepStrictEqual(command, ['DELEX', 'key']);
  });

  it('builds DELEX with IFEQ option', async () => {
    const { createCommand } = await import('../../../sources/command/delex.ts');

    const command = createCommand('key', { ifValueEquals: 'val' });

    assert.deepStrictEqual(command, ['DELEX', 'key', 'IFEQ', 'val']);
  });
});

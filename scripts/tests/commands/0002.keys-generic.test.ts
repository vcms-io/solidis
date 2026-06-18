/** Generic key-space commands: existence, type, rename, copy, move, DUMP/RESTORE, expiration. */

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

describe('keys-generic', () => {
  let client: FeaturedClient;
  let atLeast7 = false;
  const keyspace = createKeyspace('keys');

  before(async () => {
    client = await createClient();
    atLeast7 = (await detectServerCapabilities(client)).atLeast(7, 0);
  });

  after(async () => {
    await closeClient(client);
  });

  it('counts existing keys with EXISTS (variadic)', async () => {
    const first = keyspace.key('exists', 1);
    const second = keyspace.key('exists', 2);

    await client.mset({ [first]: '1', [second]: '2' });

    assert.strictEqual(await client.exists(first, second), 2);
    assert.strictEqual(await client.exists(first, first), 2);
    assert.strictEqual(
      await client.exists(keyspace.key('exists', 'absent')),
      0,
    );
  });

  it('deletes keys with DEL and UNLINK', async () => {
    const first = keyspace.key('del', 1);
    const second = keyspace.key('del', 2);
    const third = keyspace.key('del', 3);

    await client.mset({ [first]: '1', [second]: '2', [third]: '3' });

    assert.strictEqual(await client.del(first, second), 2);
    assert.strictEqual(await client.unlink([third]), 1);
  });

  it('reports the data type of each value', async () => {
    const stringKey = keyspace.key('type', 'string');
    const listKey = keyspace.key('type', 'list');
    const setKey = keyspace.key('type', 'set');
    const hashKey = keyspace.key('type', 'hash');

    await client.set(stringKey, 'value');
    await client.rpush(listKey, 'item');
    await client.sadd(setKey, 'member');
    await client.hset(hashKey, 'field', 'value');

    assert.strictEqual(await client.type(stringKey), 'STRING');
    assert.strictEqual(await client.type(listKey), 'LIST');
    assert.strictEqual(await client.type(setKey), 'SET');
    assert.strictEqual(await client.type(hashKey), 'HASH');
    assert.strictEqual(
      await client.type(keyspace.key('type', 'absent')),
      'NONE',
    );
  });

  it('renames keys with RENAME and RENAMENX', async () => {
    const source = keyspace.key('rename', 'source');
    const destination = keyspace.key('rename', 'destination');
    const occupied = keyspace.key('rename', 'occupied');

    await client.set(source, 'value');

    assert.strictEqual(await client.rename(source, destination), 'OK');
    assert.strictEqual(await client.get(destination), 'value');

    await client.set(source, 'again');
    await client.set(occupied, 'taken');

    assert.strictEqual(await client.renamenx(source, occupied), 0);
    assert.strictEqual(await client.get(source), 'again');
    assert.strictEqual(await client.get(occupied), 'taken');
    assert.strictEqual(
      await client.renamenx(source, keyspace.key('rename', 'free')),
      1,
    );
  });

  it('copies keys with and without REPLACE', async () => {
    const source = keyspace.key('copy', 'source');
    const destination = keyspace.key('copy', 'destination');

    await client.set(source, 'payload');

    assert.strictEqual(await client.copy(source, destination), 1);
    assert.strictEqual(await client.get(destination), 'payload');
    assert.strictEqual(await client.copy(source, destination), 0);

    await client.set(source, 'updated');

    assert.strictEqual(
      await client.copy(source, destination, { replace: true }),
      1,
    );
    assert.strictEqual(await client.get(destination), 'updated');

    const crossDbDestination = keyspace.key('copy-cross-db');

    assert.strictEqual(
      await client.copy(source, crossDbDestination, { destinationDatabase: 0 }),
      1,
    );
  });

  it('moves keys between databases', async () => {
    const key = keyspace.key('move');

    await client.set(key, 'value');

    assert.strictEqual(await client.move(key, 9), 1);
    assert.strictEqual(await client.exists(key), 0);

    const verifier = await createClient({ database: 9 });

    try {
      assert.strictEqual(await verifier.get(key), 'value');
      await verifier.del(key);
    } finally {
      await closeClient(verifier);
    }
  });

  it('round-trips a value through DUMP and RESTORE', async () => {
    const source = keyspace.key('dump', 'source');
    const destination = keyspace.key('dump', 'destination');

    await client.set(source, 'serialized-value');

    const serialized = (await client.send([['DUMP', source]]))[0][0];

    assert.ok(Buffer.isBuffer(serialized));

    assert.strictEqual(await client.restore(destination, 0, serialized), 'OK');
    assert.strictEqual(await client.get(destination), 'serialized-value');

    const dumpResult = await client.dump(source);
    if (dumpResult === null) {
      assert.fail('expected non-null dump result');
    }
    assert.ok(dumpResult.length > 0);
  });

  it('TOUCH updates access without removing keys', async () => {
    const first = keyspace.key('touch', 1);
    const second = keyspace.key('touch', 2);

    await client.mset({ [first]: '1', [second]: '2' });

    assert.strictEqual(await client.touch([first, second]), 2);
    assert.strictEqual(await client.get(first), '1');
    assert.strictEqual(await client.get(second), '2');
  });

  it('lists keys matching a pattern', async () => {
    const matchKeyspace = createKeyspace('keys-pattern');
    const alpha = matchKeyspace.key('alpha');
    const beta = matchKeyspace.key('beta');

    await client.mset({ [alpha]: '1', [beta]: '2' });

    const found = await client.keys(`${matchKeyspace.namespace}:*`);

    assert.deepStrictEqual([...found].sort(), [alpha, beta].sort());
  });

  it('returns a key from RANDOMKEY and a size from DBSIZE', async () => {
    await client.set(keyspace.key('randomkey'), 'value');

    const randomKeyResult = await client.randomkey();
    if (randomKeyResult === null) {
      assert.fail('expected non-null randomkey result');
    }
    assert.ok(randomKeyResult.length > 0);

    const databaseSize = await client.dbsize();
    assert.ok(databaseSize > 0);
  });

  it('reports an object encoding', async () => {
    const integerKey = keyspace.key('encoding', 'integer');

    await client.set(integerKey, '12345');

    const encoding = await client.objectEncoding(integerKey);

    assert.strictEqual(encoding, 'int');
  });

  it('applies and inspects EXPIRE / TTL', async () => {
    const key = keyspace.key('expire');

    await client.set(key, 'value');

    assert.strictEqual(await client.expire(key, 100), 1);
    const expireTtl = await client.ttl(key);
    assert.ok(expireTtl >= 1 && expireTtl <= 100);

    assert.strictEqual(await client.persist(key), 1);
    assert.strictEqual(await client.ttl(key), -1);
  });

  it('applies PEXPIRE and reads PTTL', async () => {
    const key = keyspace.key('pexpire');

    await client.set(key, 'value');

    assert.strictEqual(await client.pexpire(key, 100000), 1);
    const pexpirePttl = await client.pttl(key);
    assert.ok(pexpirePttl >= 1 && pexpirePttl <= 100000);
  });

  it('supports EXPIREAT and EXPIRETIME', async () => {
    const key = keyspace.key('expireat');
    const futureSeconds = Math.floor(Date.now() / 1000) + 1000;

    await client.set(key, 'value');

    assert.strictEqual(await client.expireat(key, futureSeconds), 1);
    const expireatTtl = await client.ttl(key);
    assert.ok(expireatTtl >= 990 && expireatTtl <= 1000);

    /** EXPIRETIME was introduced in Redis 7.0. */
    if (atLeast7) {
      assert.strictEqual(await client.expiretime(key), futureSeconds);
    }
  });

  it('supports PEXPIREAT and PEXPIRETIME', async () => {
    const key = keyspace.key('pexpireat');
    const futureMilliseconds = Date.now() + 1000000;

    await client.set(key, 'value');

    assert.strictEqual(await client.pexpireat(key, futureMilliseconds), 1);
    const pexpireatPttl = await client.pttl(key);
    assert.ok(pexpireatPttl >= 990000 && pexpireatPttl <= 1000000);

    /** PEXPIRETIME was introduced in Redis 7.0. */
    if (atLeast7) {
      assert.strictEqual(await client.pexpiretime(key), futureMilliseconds);
    }
  });

  it('reports -2 TTL for a missing key', async () => {
    assert.strictEqual(await client.ttl(keyspace.key('ttl', 'absent')), -2);
  });

  it('actually expires a key after PEXPIRE elapses', async () => {
    const key = keyspace.key('expire', 'elapse');

    await client.set(key, 'value');
    await client.pexpire(key, 50);

    await waitFor(async () => (await client.exists(key)) === 0, {
      timeout: 2000,
      interval: 20,
      description: 'key expired after pexpire',
    });
  });

  it('uses EXPIREAT with NX option', async (context) => {
    if (!atLeast7) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('expireat-nx');
    const future = Math.floor(Date.now() / 1000) + 3600;

    await client.set(key, 'val');

    assert.strictEqual(
      await client.expireat(key, future, { notExists: true }),
      1,
    );
    const expireatNxTtl = await client.ttl(key);
    assert.ok(expireatNxTtl >= 3590 && expireatNxTtl <= 3600);

    assert.strictEqual(
      await client.expireat(key, future + 100, { notExists: true }),
      0,
    );
    const expireatNxUnchangedTtl = await client.ttl(key);
    assert.ok(expireatNxUnchangedTtl >= 3590 && expireatNxUnchangedTtl <= 3600);
  });

  it('uses PEXPIRE with GT mode', async (context) => {
    if (!atLeast7) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('pexpire-gt');

    await client.set(key, 'val');
    await client.pexpire(key, 100000);

    assert.strictEqual(await client.pexpire(key, 50000, 'GT'), 0);
    const pexpireGtUnchangedPttl = await client.pttl(key);
    assert.ok(
      pexpireGtUnchangedPttl >= 90000 && pexpireGtUnchangedPttl <= 100000,
    );

    assert.strictEqual(await client.pexpire(key, 200000, 'GT'), 1);
    const pexpireGtExtendedPttl = await client.pttl(key);
    assert.ok(
      pexpireGtExtendedPttl >= 190000 && pexpireGtExtendedPttl <= 200000,
    );
  });

  it('uses PEXPIRE with LT mode', async (context) => {
    if (!atLeast7) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('pexpire-lt');

    await client.set(key, 'val');
    await client.pexpire(key, 100000);

    assert.strictEqual(await client.pexpire(key, 200000, 'LT'), 0);
    const pexpireLtUnchangedPttl = await client.pttl(key);
    assert.ok(
      pexpireLtUnchangedPttl >= 90000 && pexpireLtUnchangedPttl <= 100000,
    );

    assert.strictEqual(await client.pexpire(key, 50000, 'LT'), 1);
    const pexpireLtShortenedPttl = await client.pttl(key);
    assert.ok(
      pexpireLtShortenedPttl >= 40000 && pexpireLtShortenedPttl <= 50000,
    );
  });

  it('restores a key with REPLACE option', async () => {
    const source = keyspace.key('restore-replace-src');
    const destination = keyspace.key('restore-replace-dst');

    await client.set(source, 'original');

    const serialized = await client.dump(source);

    if (serialized === null) {
      assert.fail('expected non-null dump result');
    }

    await client.set(destination, 'existing');

    assert.strictEqual(
      await client.restore(destination, 0, serialized, { replace: true }),
      'OK',
    );
    assert.strictEqual(await client.get(destination), 'original');
  });

  it('restores a key with ABSTTL option', async () => {
    const source = keyspace.key('restore-absttl-src');
    const destination = keyspace.key('restore-absttl-dst');

    await client.set(source, 'data');

    const serialized = await client.dump(source);

    if (serialized === null) {
      assert.fail('expected non-null dump result');
    }

    const futureMs = Date.now() + 60000;

    assert.strictEqual(
      await client.restore(destination, futureMs, serialized, {
        replace: true,
        absttl: true,
      }),
      'OK',
    );

    const absttlPttl = await client.pttl(destination);
    assert.ok(absttlPttl >= 59000 && absttlPttl <= 60000);
    assert.strictEqual(await client.get(destination), 'data');
  });

  it('restores a key with IDLETIME option', async () => {
    const source = keyspace.key('restore-idle-src');
    const destination = keyspace.key('restore-idle-dst');

    await client.set(source, 'extra');

    const serialized = await client.dump(source);

    if (serialized === null) {
      assert.fail('expected non-null dump result');
    }

    assert.strictEqual(
      await client.restore(destination, 0, serialized, {
        replace: true,
        idletime: 100,
      }),
      'OK',
    );

    assert.strictEqual(await client.get(destination), 'extra');
  });

  it('uses LOLWUT with VERSION and optional arguments', async () => {
    const lolwutResult = await client.lolwut(5, '10', '20');

    assert.strictEqual(typeof lolwutResult, 'string');
    assert.ok(lolwutResult.length > 0);
  });

  it('returns null from GETBUFFER on missing key', async () => {
    const result = await client.getBuffer(keyspace.key('getbuffer-missing'));

    assert.strictEqual(result, null);
  });

  it('uses PEXPIREAT with NX mode', async (context) => {
    if (!atLeast7) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('pexpireat-nx');
    const futureMs = Date.now() + 60000;

    await client.set(key, 'val');

    assert.strictEqual(await client.pexpireat(key, futureMs, 'NX'), 1);
    const pexpireatNxPttl = await client.pttl(key);
    assert.ok(pexpireatNxPttl >= 59000 && pexpireatNxPttl <= 60000);

    assert.strictEqual(await client.pexpireat(key, futureMs + 1000, 'NX'), 0);
    const pexpireatNxUnchangedPttl = await client.pttl(key);
    assert.ok(
      pexpireatNxUnchangedPttl >= 58000 && pexpireatNxUnchangedPttl <= 60000,
    );
  });

  it('returns null from OBJECT FREQ on missing key', async () => {
    const result = await client.objectFreq(keyspace.key('objfreq-missing'));

    assert.strictEqual(result, null);
  });

  it('returns null from OBJECT IDLETIME on missing key', async () => {
    const result = await client.objectIdletime(
      keyspace.key('objidletime-missing'),
    );

    assert.strictEqual(result, null);
  });
});

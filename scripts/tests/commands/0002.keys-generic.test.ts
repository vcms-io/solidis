/** Generic key-space commands: existence, type, rename, copy, move, DUMP/RESTORE, expiration. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  delay,
  detectServerCapabilities,
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

    if (!Buffer.isBuffer(serialized)) {
      return;
    }

    assert.strictEqual(await client.restore(destination, 0, serialized), 'OK');
    assert.strictEqual(await client.get(destination), 'serialized-value');

    assert.strictEqual(typeof (await client.dump(source)), 'string');
  });

  it('TOUCH updates access without removing keys', async () => {
    const first = keyspace.key('touch', 1);
    const second = keyspace.key('touch', 2);

    await client.mset({ [first]: '1', [second]: '2' });

    assert.strictEqual(await client.touch([first, second]), 2);
  });

  it('lists keys matching a pattern', async () => {
    const matchKeyspace = createKeyspace('keys-pattern');
    const alpha = matchKeyspace.key('alpha');
    const beta = matchKeyspace.key('beta');

    await client.mset({ [alpha]: '1', [beta]: '2' });

    const found = await client.keys(`${matchKeyspace.namespace}:*`);

    assert.strictEqual(found.length, 2);
    assert.ok(found.includes(alpha));
    assert.ok(found.includes(beta));
  });

  it('returns a key from RANDOMKEY and a size from DBSIZE', async () => {
    await client.set(keyspace.key('randomkey'), 'value');

    assert.notStrictEqual(await client.randomkey(), undefined);
    assert.ok((await client.dbsize()) > 0);
  });

  it('reports an object encoding', async () => {
    const integerKey = keyspace.key('encoding', 'integer');

    await client.set(integerKey, '12345');

    const encoding = await client.objectEncoding(integerKey);

    assert.ok(typeof encoding === 'string' && encoding.length > 0);
  });

  it('applies and inspects EXPIRE / TTL', async () => {
    const key = keyspace.key('expire');

    await client.set(key, 'value');

    assert.strictEqual(await client.expire(key, 100), 1);
    assert.ok((await client.ttl(key)) > 90);
    assert.ok((await client.ttl(key)) <= 100);

    assert.strictEqual(await client.persist(key), 1);
    assert.strictEqual(await client.ttl(key), -1);
  });

  it('applies PEXPIRE and reads PTTL', async () => {
    const key = keyspace.key('pexpire');

    await client.set(key, 'value');

    assert.strictEqual(await client.pexpire(key, 100000), 1);
    assert.ok((await client.pttl(key)) > 90000);
  });

  it('supports EXPIREAT and EXPIRETIME', async () => {
    const key = keyspace.key('expireat');
    const futureSeconds = Math.floor(Date.now() / 1000) + 1000;

    await client.set(key, 'value');

    assert.strictEqual(await client.expireat(key, futureSeconds), 1);
    assert.ok((await client.ttl(key)) > 900);

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
    assert.ok((await client.pttl(key)) > 900000);

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

    await delay(110);

    assert.strictEqual(await client.exists(key), 0);
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
    assert.strictEqual(
      await client.expireat(key, future + 100, { notExists: true }),
      0,
    );
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
    assert.strictEqual(await client.pexpire(key, 200000, 'GT'), 1);
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
    assert.strictEqual(await client.pexpire(key, 50000, 'LT'), 1);
  });

  it('restores a key with REPLACE option', async () => {
    const source = keyspace.key('restore-replace-src');
    const destination = keyspace.key('restore-replace-dst');

    await client.set(source, 'original');

    const serialized = await client.dump(source);

    assert.ok(serialized !== null);

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

    assert.ok(serialized !== null);

    const futureMs = Date.now() + 60000;

    assert.strictEqual(
      await client.restore(destination, futureMs, serialized, {
        replace: true,
        absttl: true,
      }),
      'OK',
    );

    assert.ok((await client.pttl(destination)) > 50000);
  });

  it('restores a key with IDLETIME option', async () => {
    const source = keyspace.key('restore-idle-src');
    const destination = keyspace.key('restore-idle-dst');

    await client.set(source, 'extra');

    const serialized = await client.dump(source);

    assert.ok(serialized !== null);

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
    const result = await client.lolwut(5, '10', '20');

    assert.strictEqual(typeof result, 'string');
    assert.ok(result.length > 0);
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
    assert.strictEqual(await client.pexpireat(key, futureMs + 1000, 'NX'), 0);
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

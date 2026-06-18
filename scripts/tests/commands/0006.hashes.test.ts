/** Hash value type: field CRUD, counters, random sampling, iteration, and per-field TTLs. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('hashes', () => {
  let client: FeaturedClient;
  let supportsFieldTtl = false;
  const keyspace = createKeyspace('hashes');

  before(async () => {
    client = await createClient();

    const capabilities = await detectServerCapabilities(client);

    supportsFieldTtl = capabilities.isValkey
      ? capabilities.atLeast(9, 0)
      : capabilities.atLeast(7, 4);
  });

  after(async () => {
    await closeClient(client);
  });

  it('sets and reads a single field', async () => {
    const key = keyspace.key('single');

    assert.strictEqual(await client.hset(key, 'field', 'value'), 1);
    assert.strictEqual(await client.hget(key, 'field'), 'value');
    assert.strictEqual(await client.hset(key, 'field', 'updated'), 0);
    assert.strictEqual(await client.hget(key, 'field'), 'updated');
    assert.strictEqual(await client.hget(key, 'absent'), null);
  });

  it('bulk sets and reads with HMSET / HMGET / HGETALL', async () => {
    const key = keyspace.key('bulk');

    assert.strictEqual(
      await client.hmset(key, { one: '1', two: '2', three: '3' }),
      'OK',
    );

    assert.deepStrictEqual(await client.hmget(key, 'one', 'three', 'absent'), [
      '1',
      '3',
      null,
    ]);

    assert.deepStrictEqual(await client.hgetall(key), {
      one: '1',
      two: '2',
      three: '3',
    });
  });

  it('reports existence, length, and field length', async () => {
    const key = keyspace.key('introspect');

    await client.hmset(key, { name: 'solidis', kind: 'client' });

    assert.strictEqual(await client.hexists(key, 'name'), 1);
    assert.strictEqual(await client.hexists(key, 'absent'), 0);
    assert.strictEqual(await client.hlen(key), 2);
    assert.strictEqual(await client.hstrlen(key, 'name'), 7);
  });

  it('lists keys and values', async () => {
    const key = keyspace.key('keys-values');

    await client.hmset(key, { a: '1', b: '2' });

    assert.deepStrictEqual([...(await client.hkeys(key))].sort(), ['a', 'b']);
    assert.deepStrictEqual([...(await client.hvals(key))].sort(), ['1', '2']);
  });

  it('deletes individual fields', async () => {
    const key = keyspace.key('delete');

    await client.hmset(key, { a: '1', b: '2', c: '3' });

    assert.strictEqual(await client.hdel(key, 'a', 'b'), 2);
    assert.strictEqual(await client.hlen(key), 1);
    assert.deepStrictEqual(await client.hgetall(key), { c: '3' });
  });

  it('increments integer and float fields', async () => {
    const key = keyspace.key('increment');

    assert.strictEqual(await client.hincrby(key, 'counter', 5), 5);
    assert.strictEqual(await client.hincrby(key, 'counter', -2), 3);

    const floatValue = await client.hincrbyfloat(key, 'ratio', 1.5);

    assert.strictEqual(floatValue, '1.5');
  });

  it('sets a field only if absent with HSETNX', async () => {
    const key = keyspace.key('setnx');

    assert.strictEqual(await client.hsetnx(key, 'field', 'first'), 1);
    assert.strictEqual(await client.hsetnx(key, 'field', 'second'), 0);
    assert.strictEqual(await client.hget(key, 'field'), 'first');
  });

  it('samples random fields with HRANDFIELD', async () => {
    const key = keyspace.key('randfield');

    await client.hmset(key, { a: '1', b: '2', c: '3' });

    const single = await client.hrandfield(key);

    if (single === null || typeof single !== 'string') {
      assert.fail('expected non-null string from hrandfield');
    }
    assert.ok(['a', 'b', 'c'].includes(single));

    const several = await client.hrandfield(key, 2);

    if (several === null || !Array.isArray(several)) {
      assert.fail('expected non-null array from hrandfield');
    }
    assert.strictEqual(several.length, 2);
    for (const field of several) {
      assert.ok(['a', 'b', 'c'].includes(field));
    }
    assert.notStrictEqual(several[0], several[1]);

    const withValues = await client.hrandfield(key, 3, true);

    assert.deepStrictEqual(withValues, { a: '1', b: '2', c: '3' });
  });

  it('iterates a large hash with HSCAN', async () => {
    const key = keyspace.key('hscan');
    const mapping: Record<string, string> = {};

    for (let index = 0; index < 400; index += 1) {
      mapping[`field-${index}`] = `${index}`;
    }

    await client.hmset(key, mapping);

    const collected: Record<string, string> = {};

    for await (const batch of client.hscan(key, { count: 50 })) {
      Object.assign(collected, batch);
    }

    assert.deepStrictEqual(collected, mapping);
  });

  it('preserves binary values in hash fields', async () => {
    const key = keyspace.key('binary');
    const payload = Buffer.from([0x00, 0x01, 0xfe, 0xff]);

    assert.strictEqual(await client.hset(key, 'blob', payload), 1);

    const reply = await client.send([['HGET', key, 'blob']]);
    const value = reply[0][0];

    assert.deepStrictEqual(value, payload);
  });

  it('HEXPIRE sets and HTTL reads per-field TTLs', async (context) => {
    if (!supportsFieldTtl) {
      context.skip('server does not support hash-field TTLs');
      return;
    }

    const key = keyspace.key('hexpire');

    await client.hmset(key, { withTtl: '1', withoutTtl: '2' });

    assert.deepStrictEqual(await client.hexpire(key, 100, ['withTtl']), [1]);

    const ttls = await client.httl(key, ['withTtl', 'withoutTtl', 'missing']);
    const withTtlSeconds = ttls[0];

    assert.ok(withTtlSeconds >= 1 && withTtlSeconds <= 100);
    assert.strictEqual(ttls[1], -1);
    assert.strictEqual(ttls[2], -2);
  });

  it('HPEXPIRE/HPTTL operate in milliseconds', async (context) => {
    if (!supportsFieldTtl) {
      context.skip('server does not support hash-field TTLs');
      return;
    }

    const key = keyspace.key('hpexpire');

    await client.hset(key, 'field', 'value');

    assert.deepStrictEqual(await client.hpexpire(key, 100000, ['field']), [1]);

    const pttls = await client.hpttl(key, ['field']);
    const fieldMilliseconds = pttls[0];

    assert.ok(fieldMilliseconds >= 1 && fieldMilliseconds <= 100000);
  });

  it('HEXPIREAT/HEXPIRETIME pin an absolute field TTL', async (context) => {
    if (!supportsFieldTtl) {
      context.skip('server does not support hash-field TTLs');
      return;
    }

    const key = keyspace.key('hexpireat');
    const future = Math.floor(Date.now() / 1000) + 1000;

    await client.hset(key, 'field', 'value');

    assert.deepStrictEqual(await client.hexpireat(key, future, ['field']), [1]);
    assert.deepStrictEqual(await client.hexpiretime(key, ['field']), [future]);
  });

  it('HEXPIRE honours conditional modes', async (context) => {
    if (!supportsFieldTtl) {
      context.skip('server does not support hash-field TTLs');
      return;
    }

    const key = keyspace.key('hexpire-mode');

    await client.hset(key, 'field', 'value');
    await client.hexpire(key, 100, ['field']);

    /** GT only extends, so a shorter TTL must be rejected (reply 0). */
    assert.deepStrictEqual(await client.hexpire(key, 50, ['field'], 'GT'), [0]);

    const unchangedTtl = (await client.httl(key, ['field']))[0];

    assert.ok(unchangedTtl >= 1 && unchangedTtl <= 100);

    assert.deepStrictEqual(
      await client.hexpire(key, 200, ['field'], 'GT'),
      [1],
    );

    const extendedTtl = (await client.httl(key, ['field']))[0];

    assert.ok(extendedTtl >= 1 && extendedTtl <= 200);
  });

  it('HPERSIST clears a field TTL', async (context) => {
    if (!supportsFieldTtl) {
      context.skip('server does not support hash-field TTLs');
      return;
    }

    const key = keyspace.key('hpersist');

    await client.hset(key, 'field', 'value');
    await client.hexpire(key, 100, ['field']);

    assert.deepStrictEqual(await client.hpersist(key, ['field']), [1]);
    assert.deepStrictEqual(await client.httl(key, ['field']), [-1]);
    assert.deepStrictEqual(await client.hpersist(key, ['field']), [-1]);
  });

  it('HPEXPIREAT/HPEXPIRETIME pin an absolute millisecond TTL', async (context) => {
    if (!supportsFieldTtl) {
      context.skip('server does not support hash-field TTLs');
      return;
    }

    const key = keyspace.key('hpexpireat');
    const futureMs = Date.now() + 600_000;

    await client.hset(key, 'field', 'value');

    assert.deepStrictEqual(
      await client.hpexpireat(key, futureMs, ['field']),
      [1],
    );

    const times = await client.hpexpiretime(key, ['field']);

    assert.strictEqual(times[0], futureMs);
  });

  it('applies HEXPIREAT with GT mode', async (context) => {
    if (!supportsFieldTtl) {
      context.skip('server does not support hash-field TTLs');
      return;
    }

    const key = keyspace.key('hexpireat-gt');
    const farFuture = Math.floor(Date.now() / 1000) + 120;
    const nearFuture = Math.floor(Date.now() / 1000) + 60;

    await client.hset(key, 'field', 'value');
    await client.hexpireat(key, farFuture, ['field']);

    const result = await client.hexpireat(key, nearFuture, ['field'], 'GT');

    assert.deepStrictEqual(result, [0]);
    assert.deepStrictEqual(await client.hexpiretime(key, ['field']), [
      farFuture,
    ]);
  });

  it('applies HEXPIREAT with LT mode', async (context) => {
    if (!supportsFieldTtl) {
      context.skip('server does not support hash-field TTLs');
      return;
    }

    const key = keyspace.key('hexpireat-lt');
    const farFuture = Math.floor(Date.now() / 1000) + 120;
    const nearFuture = Math.floor(Date.now() / 1000) + 60;

    await client.hset(key, 'field', 'value');
    await client.hexpireat(key, farFuture, ['field']);

    const result = await client.hexpireat(key, nearFuture, ['field'], 'LT');

    assert.deepStrictEqual(result, [1]);
    assert.deepStrictEqual(await client.hexpiretime(key, ['field']), [
      nearFuture,
    ]);
  });

  it('applies HPEXPIRE with GT mode', async (context) => {
    if (!supportsFieldTtl) {
      context.skip('server does not support hash-field TTLs');
      return;
    }

    const key = keyspace.key('hpexpire-gt');

    await client.hset(key, 'field', 'value');
    await client.hpexpire(key, 120000, ['field']);

    const result = await client.hpexpire(key, 60000, ['field'], 'GT');

    assert.deepStrictEqual(result, [0]);

    const unchangedMilliseconds = (await client.hpttl(key, ['field']))[0];

    assert.ok(unchangedMilliseconds >= 1 && unchangedMilliseconds <= 120000);
  });

  it('applies HPEXPIRE with LT mode', async (context) => {
    if (!supportsFieldTtl) {
      context.skip('server does not support hash-field TTLs');
      return;
    }

    const key = keyspace.key('hpexpire-lt');

    await client.hset(key, 'field', 'value');
    await client.hpexpire(key, 120000, ['field']);

    const result = await client.hpexpire(key, 60000, ['field'], 'LT');

    assert.deepStrictEqual(result, [1]);

    const shortenedMilliseconds = (await client.hpttl(key, ['field']))[0];

    assert.ok(shortenedMilliseconds >= 1 && shortenedMilliseconds <= 60000);
  });

  it('applies HPEXPIREAT with GT mode', async (context) => {
    if (!supportsFieldTtl) {
      context.skip('server does not support hash-field TTLs');
      return;
    }

    const key = keyspace.key('hpexpireat-gt');
    const farFuture = Date.now() + 120000;
    const nearFuture = Date.now() + 60000;

    await client.hset(key, 'field', 'value');
    await client.hpexpireat(key, farFuture, ['field']);

    const result = await client.hpexpireat(key, nearFuture, ['field'], 'GT');

    assert.deepStrictEqual(result, [0]);
    assert.deepStrictEqual(await client.hpexpiretime(key, ['field']), [
      farFuture,
    ]);
  });

  it('applies HPEXPIREAT with LT mode', async (context) => {
    if (!supportsFieldTtl) {
      context.skip('server does not support hash-field TTLs');
      return;
    }

    const key = keyspace.key('hpexpireat-lt');
    const farFuture = Date.now() + 120000;
    const nearFuture = Date.now() + 60000;

    await client.hset(key, 'field', 'value');
    await client.hpexpireat(key, farFuture, ['field']);

    const result = await client.hpexpireat(key, nearFuture, ['field'], 'LT');

    assert.deepStrictEqual(result, [1]);
    assert.deepStrictEqual(await client.hpexpiretime(key, ['field']), [
      nearFuture,
    ]);
  });
});

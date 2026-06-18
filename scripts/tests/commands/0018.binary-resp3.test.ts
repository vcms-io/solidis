/** Binary safety and RESP3 protocol coverage. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  randomBuffer,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('binary-resp3', () => {
  let client: FeaturedClient;
  const keyspace = createKeyspace('binary');

  before(async () => {
    client = await createClient();
  });

  after(async () => {
    await closeClient(client);
  });

  it('round-trips arbitrary binary payloads', async () => {
    const key = keyspace.key('random-bytes');
    const payload = randomBuffer(4096);

    await client.set(key, payload);

    const value = await client.getBuffer(key);

    assert.deepStrictEqual(value, payload);
  });

  it('preserves embedded NUL bytes and length', async () => {
    const key = keyspace.key('embedded-nul');
    const payload = Buffer.from('a\u0000b\u0000c', 'binary');

    await client.set(key, payload);

    assert.strictEqual(await client.strlen(key), 5);

    const retrieved = await client.getBuffer(key);

    assert.deepStrictEqual(retrieved, payload);
  });

  it('preserves multi-byte UTF-8 strings', async () => {
    const key = keyspace.key('utf8');
    const value = '?�녕?�세???�� ?�ん?�ち??Ω';

    await client.set(key, value);

    assert.strictEqual(await client.get(key), value);
    assert.strictEqual(await client.strlen(key), Buffer.byteLength(value));
  });

  it('handles a one-megabyte value', async () => {
    const key = keyspace.key('large');
    const payload = randomBuffer(1024 * 1024);

    await client.set(key, payload);

    const value = await client.getBuffer(key);

    assert.deepStrictEqual(value, payload);
  });

  it('stores binary field names and values in hashes', async () => {
    const key = keyspace.key('hash-binary');
    const field = 'binary-field';
    const payload = randomBuffer(256);

    await client.hset(key, field, payload);

    const reply = await client.send([['HGET', key, field]]);

    assert.deepStrictEqual(reply, [[payload]]);
  });

  it('runs core string commands under RESP3', async () => {
    const resp3 = await createClient({ protocol: 'RESP3' });

    try {
      const key = keyspace.key('resp3', 'string');

      assert.strictEqual(await resp3.set(key, 'value'), 'OK');
      assert.strictEqual(await resp3.get(key), 'value');
      assert.strictEqual(await resp3.incr(keyspace.key('resp3', 'counter')), 1);
    } finally {
      await closeClient(resp3);
    }
  });

  it('returns hash maps as records under RESP3', async () => {
    const resp3 = await createClient({ protocol: 'RESP3' });

    try {
      const key = keyspace.key('resp3', 'hash');

      await resp3.hmset(key, { one: '1', two: '2' });

      assert.deepStrictEqual(await resp3.hgetall(key), { one: '1', two: '2' });
    } finally {
      await closeClient(resp3);
    }
  });

  it('returns set replies under RESP3', async () => {
    const resp3 = await createClient({ protocol: 'RESP3' });

    try {
      const key = keyspace.key('resp3', 'set');

      await resp3.sadd(key, 'a', 'b', 'c');

      assert.deepStrictEqual([...(await resp3.smembers(key))].sort(), [
        'a',
        'b',
        'c',
      ]);
    } finally {
      await closeClient(resp3);
    }
  });

  it('returns double scores under RESP3', async () => {
    const resp3 = await createClient({ protocol: 'RESP3' });

    try {
      const key = keyspace.key('resp3', 'zset');

      await resp3.zadd(key, 3.14, 'pi');

      assert.strictEqual(await resp3.zscore(key, 'pi'), 3.14);
    } finally {
      await closeClient(resp3);
    }
  });
});

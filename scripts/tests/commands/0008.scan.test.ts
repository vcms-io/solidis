/**
 * Keyspace iteration with SCAN, including MATCH and TYPE filters and the
 * guarantee that a full iteration visits every matching key exactly once even
 * while the cursor advances in small COUNT increments.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { closeClient, createClient, createKeyspace } from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('scan', () => {
  let client: FeaturedClient;
  const keyspace = createKeyspace('scan');

  before(async () => {
    client = await createClient({ database: 13 });

    await client.flushdb();
  });

  after(async () => {
    await closeClient(client);
  });

  it('iterates the full keyspace with a MATCH filter', async () => {
    const mapping: Record<string, string> = {};

    for (let index = 0; index < 200; index += 1) {
      mapping[keyspace.key('item', index)] = `${index}`;
    }

    await client.mset(mapping);

    const seen = new Set<string>();

    for await (const batch of client.scan({
      match: `${keyspace.namespace}:item:*`,
      count: 50,
    })) {
      for (const key of batch) {
        seen.add(key);
      }
    }

    assert.deepStrictEqual([...seen].sort(), Object.keys(mapping).sort());
  });

  it('filters by value type', async () => {
    const stringKey = keyspace.key('typed', 'string');
    const listKey = keyspace.key('typed', 'list');

    await client.set(stringKey, 'value');
    await client.rpush(listKey, 'item');

    const listsOnly = new Set<string>();

    for await (const batch of client.scan({
      match: `${keyspace.namespace}:typed:*`,
      type: 'LIST',
      count: 10,
    })) {
      for (const key of batch) {
        listsOnly.add(key);
      }
    }

    assert.strictEqual(listsOnly.size, 1);
    assert.deepStrictEqual([...listsOnly], [listKey]);
  });

  it('reads its options when called, so changing them afterwards changes nothing', async () => {
    const hash = keyspace.key('options', 'hash');
    const set = keyspace.key('options', 'set');
    const sortedSet = keyspace.key('options', 'zset');

    await client.mset({
      [keyspace.key('options', 'a', 1)]: '1',
      [keyspace.key('options', 'b', 1)]: '1',
    });
    await client.hset(hash, { a1: '1', b1: '1' });
    await client.sadd(set, 'a1', 'b1');
    await client.zadd(sortedSet, 1, 'a1');
    await client.zadd(sortedSet, 2, 'b1');

    const keys = { match: `${keyspace.namespace}:options:a:*` };
    const fields = { match: 'a*' };
    const members = { match: 'a*' };
    const sortedMembers = { match: 'a*' };
    const iterators = [
      client.scan(keys),
      client.hscan(hash, fields),
      client.sscan(set, members),
      client.zscan(sortedSet, sortedMembers),
    ];

    keys.match = `${keyspace.namespace}:options:b:*`;
    fields.match = 'b*';
    members.match = 'b*';
    sortedMembers.match = 'b*';

    const seen: unknown[][] = [];

    for (const iterator of iterators) {
      const items: unknown[] = [];

      for await (const batch of iterator) {
        items.push(...(Array.isArray(batch) ? batch : Object.keys(batch)));
      }

      seen.push(items);
    }

    assert.deepStrictEqual(seen, [
      [keyspace.key('options', 'a', 1)],
      ['a1'],
      ['a1'],
      [{ member: 'a1', score: 1 }],
    ]);
  });

  it('returns nothing for a non-matching pattern', async () => {
    const seen: string[] = [];

    for await (const batch of client.scan({
      match: `${keyspace.namespace}:does-not-exist:*`,
      count: 50,
    })) {
      seen.push(...batch);
    }

    assert.deepStrictEqual(seen, []);
  });
});

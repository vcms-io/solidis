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
    client = await createClient();
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

    assert.strictEqual(seen.size, 200);
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

/**
 * RedisBloom probabilistic structures: Bloom filters (BF.*) and Cuckoo filters
 * (CF.*). Gated on module availability so the suite self-skips without
 * RedisBloom.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  isCommandSupported,
  range,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('modules-bloom-cuckoo', () => {
  let client: FeaturedClient;
  let bloomAvailable = false;
  let cuckooAvailable = false;
  const keyspace = createKeyspace('probabilistic');

  before(async () => {
    client = await createClient();
    bloomAvailable = await isCommandSupported(client, ['BF.ADD']);
    cuckooAvailable = await isCommandSupported(client, ['CF.ADD']);
  });

  after(async () => {
    await closeClient(client);
  });

  it('adds and tests Bloom membership', async (context) => {
    if (!bloomAvailable) {
      context.skip('RedisBloom not loaded');
      return;
    }

    const key = keyspace.key('bloom');

    assert.strictEqual(await client.bfAdd(key, 'alpha'), true);
    assert.strictEqual(await client.bfAdd(key, 'alpha'), false);
    assert.strictEqual(await client.bfExists(key, 'alpha'), true);
    assert.strictEqual(await client.bfExists(key, 'absent'), false);
  });

  it('adds and tests Bloom membership in bulk', async (context) => {
    if (!bloomAvailable) {
      context.skip('RedisBloom not loaded');
      return;
    }

    const key = keyspace.key('bloom-bulk');

    assert.deepStrictEqual(
      await client.bfMadd(key, ['a', 'b', 'c']),
      [1, 1, 1],
    );

    const exists = await client.bfMexists(key, ['a', 'b', 'absent']);

    assert.deepStrictEqual(exists, [1, 1, 0]);
  });

  it('reserves a Bloom filter with a target error rate', async (context) => {
    if (!bloomAvailable) {
      context.skip('RedisBloom not loaded');
      return;
    }

    const key = keyspace.key('bloom-reserve');

    assert.strictEqual(await client.bfReserve(key, 0.001, 1000), 'OK');

    await Promise.all(
      range(500).map((index) => client.bfAdd(key, `item-${index}`)),
    );

    assert.strictEqual(await client.bfExists(key, 'item-0'), true);
  });

  it('has no false negatives across many Bloom inserts', async (context) => {
    if (!bloomAvailable) {
      context.skip('RedisBloom not loaded');
      return;
    }

    const key = keyspace.key('bloom-no-false-negative');
    const items = range(2000).map((index) => `member-${index}`);

    await client.bfMadd(key, items);

    const checks = await client.bfMexists(key, items);

    assert.deepStrictEqual(
      checks,
      Array.from({ length: 2000 }, () => 1),
    );
  });

  it('adds, counts, and deletes Cuckoo items', async (context) => {
    if (!cuckooAvailable) {
      context.skip('RedisBloom (cuckoo) not loaded');
      return;
    }

    const key = keyspace.key('cuckoo');

    assert.strictEqual(await client.cfAdd(key, 'x'), true);
    assert.strictEqual(await client.cfExists(key, 'x'), true);
    assert.strictEqual(await client.cfCount(key, 'x'), 1);
    assert.strictEqual(await client.cfDel(key, 'x'), true);
    assert.strictEqual(await client.cfExists(key, 'x'), false);
  });

  it('reports cardinality with BF.CARD', async (context) => {
    if (!bloomAvailable) {
      context.skip('RedisBloom not loaded');
      return;
    }

    const key = keyspace.key('bloom-card');

    await client.bfMadd(key, ['a', 'b', 'c']);

    const card = await client.bfCard(key);

    assert.strictEqual(card, 3);
  });

  it('reports filter info with BF.INFO', async (context) => {
    if (!bloomAvailable) {
      context.skip('RedisBloom not loaded');
      return;
    }

    const key = keyspace.key('bloom-info');

    await client.bfReserve(key, 0.01, 500);
    await client.bfAdd(key, 'test');

    const info = await client.bfInfo(key);

    assert.strictEqual(info.capacity, 500);
    assert.strictEqual(info.numberOfItemsInserted, 1);
  });

  it('bulk inserts with BF.INSERT', async (context) => {
    if (!bloomAvailable) {
      context.skip('RedisBloom not loaded');
      return;
    }

    const key = keyspace.key('bloom-insert');

    const results = await client.bfInsert(key, ['x', 'y', 'z'], {
      capacity: 1000,
      error: 0.01,
    });

    assert.deepStrictEqual(results, [1, 1, 1]);
    assert.strictEqual(await client.bfExists(key, 'x'), true);
  });

  it('adds only if not existing with CF.ADDNX', async (context) => {
    if (!cuckooAvailable) {
      context.skip('RedisBloom (cuckoo) not loaded');
      return;
    }

    const key = keyspace.key('cuckoo-addnx');

    assert.strictEqual(await client.cfAddnx(key, 'item'), true);
    assert.strictEqual(await client.cfAddnx(key, 'item'), false);
  });

  it('reports cuckoo info with CF.INFO', async (context) => {
    if (!cuckooAvailable) {
      context.skip('RedisBloom (cuckoo) not loaded');
      return;
    }

    const key = keyspace.key('cuckoo-info');

    await client.cfReserve(key, 1000);
    await client.cfAdd(key, 'test');

    const info = await client.cfInfo(key);

    assert.strictEqual(info.numberOfItemsInserted, 1);
  });

  it('bulk inserts into a cuckoo filter with CF.INSERT', async (context) => {
    if (!cuckooAvailable) {
      context.skip('RedisBloom (cuckoo) not loaded');
      return;
    }

    const key = keyspace.key('cuckoo-insert');

    const results = await client.cfInsert(key, ['a', 'b', 'c']);

    assert.deepStrictEqual(results, [true, true, true]);
  });

  it('checks multiple items with CF.MEXISTS', async (context) => {
    if (!cuckooAvailable) {
      context.skip('RedisBloom (cuckoo) not loaded');
      return;
    }

    const key = keyspace.key('cuckoo-mexists');

    await client.cfAdd(key, 'present');

    const results = await client.cfMexists(key, ['present', 'absent']);

    assert.strictEqual(results[0], true);
    assert.strictEqual(results[1], false);
  });

  it('reserves a cuckoo filter with CF.RESERVE', async (context) => {
    if (!cuckooAvailable) {
      context.skip('RedisBloom (cuckoo) not loaded');
      return;
    }

    const key = keyspace.key('cuckoo-reserve');

    assert.strictEqual(await client.cfReserve(key, 2000), 'OK');

    await client.cfAdd(key, 'item');

    assert.strictEqual(await client.cfExists(key, 'item'), true);
  });

  it('conditionally inserts into a cuckoo filter with CF.INSERTNX', async (context) => {
    if (!cuckooAvailable) {
      context.skip('RedisBloom (cuckoo) not loaded');
      return;
    }

    const key = keyspace.key('cuckoo-insertnx');

    const first = await client.cfInsertnx(key, ['a', 'b', 'c']);

    assert.deepStrictEqual(first, [true, true, true]);

    const second = await client.cfInsertnx(key, ['a', 'd']);

    assert.strictEqual(second[0], false);
    assert.strictEqual(second[1], true);
  });

  it('dumps and restores a Bloom filter with BF.SCANDUMP / BF.LOADCHUNK', async (context) => {
    if (
      !bloomAvailable ||
      !(await isCommandSupported(client, ['BF.SCANDUMP']))
    ) {
      context.skip('BF.SCANDUMP not available');
      return;
    }

    const source = keyspace.key('bloom-scandump');
    const destination = keyspace.key('bloom-loadchunk');

    for (const item of range(100)) {
      await client.bfAdd(source, `item-${item}`);
    }

    const chunks: Array<{ iterator: number; data: Buffer }> = [];
    let cursor = 0;

    do {
      const [nextIterator, data] = await client.bfScandump(source, cursor);

      cursor = nextIterator;

      if (data.length > 0) {
        chunks.push({ iterator: nextIterator, data });
      }
    } while (cursor !== 0);

    assert.ok(chunks.length > 0);

    for (const chunk of chunks) {
      assert.strictEqual(
        await client.bfLoadchunk(destination, chunk.iterator, chunk.data),
        'OK',
      );
    }

    assert.strictEqual(await client.bfExists(destination, 'item-0'), true);
    assert.strictEqual(await client.bfExists(destination, 'item-99'), true);
  });

  it('dumps and restores a Cuckoo filter with CF.SCANDUMP / CF.LOADCHUNK', async (context) => {
    if (
      !cuckooAvailable ||
      !(await isCommandSupported(client, ['CF.SCANDUMP']))
    ) {
      context.skip('CF.SCANDUMP not available');
      return;
    }

    const source = keyspace.key('cuckoo-scandump');
    const destination = keyspace.key('cuckoo-loadchunk');

    for (const item of range(50)) {
      await client.cfAdd(source, `item-${item}`);
    }

    const chunks: Array<{ iterator: number; data: Buffer }> = [];
    let cursor = 0;

    do {
      const [nextIterator, data] = await client.cfScandump(source, cursor);

      cursor = nextIterator;

      if (data !== null && data.length > 0) {
        chunks.push({ iterator: nextIterator, data });
      }
    } while (cursor !== 0);

    assert.ok(chunks.length > 0);

    for (const chunk of chunks) {
      assert.strictEqual(
        await client.cfLoadchunk(destination, chunk.iterator, chunk.data),
        'OK',
      );
    }

    assert.strictEqual(await client.cfExists(destination, 'item-0'), true);
    assert.strictEqual(await client.cfExists(destination, 'item-49'), true);
  });

  it('reserves a Bloom filter with EXPANSION and NONSCALING options', async (context) => {
    if (!bloomAvailable) {
      context.skip('RedisBloom not loaded');
      return;
    }

    const key = keyspace.key('bloom-reserve-opts');

    assert.strictEqual(await client.bfReserve(key, 0.01, 500, 2), 'OK');

    const keyNs = keyspace.key('bloom-nonscaling');

    assert.strictEqual(
      await client.bfReserve(keyNs, 0.01, 500, undefined, true),
      'OK',
    );
  });

  it('inserts with BF.INSERT using EXPANSION and NOCREATE options', async (context) => {
    if (!bloomAvailable) {
      context.skip('RedisBloom not loaded');
      return;
    }

    const key = keyspace.key('bloom-insert-expansion');

    const results = await client.bfInsert(key, ['a', 'b'], {
      capacity: 500,
      error: 0.01,
      expansion: 4,
    });

    assert.deepStrictEqual(results, [1, 1]);

    const nocreateKey = keyspace.key('bloom-nocreate-missing');

    await assert.rejects(
      () => client.bfInsert(nocreateKey, ['x'], { nocreate: true }),
      /not found/i,
    );
  });

  it('reserves a cuckoo filter with BUCKETSIZE and EXPANSION', async (context) => {
    if (!cuckooAvailable) {
      context.skip('RedisBloom (cuckoo) not loaded');
      return;
    }

    const key = keyspace.key('cuckoo-reserve-opts');

    assert.strictEqual(await client.cfReserve(key, 1024, 4, 20, 2), 'OK');
  });

  it('builds CF.INSERT with CAPACITY option', async () => {
    const { buildCuckooFilterInsertCommand } = await import(
      '../../../sources/command/utils/command.ts'
    );

    const command = buildCuckooFilterInsertCommand(
      'CF.INSERT',
      'key',
      ['a', 'b'],
      { capacity: 1000 },
    );

    assert.deepStrictEqual(command, [
      'CF.INSERT',
      'key',
      'CAPACITY',
      '1000',
      'ITEMS',
      'a',
      'b',
    ]);
  });

  it('builds CF.INSERT with NOCREATE option (ignores capacity)', async () => {
    const { buildCuckooFilterInsertCommand } = await import(
      '../../../sources/command/utils/command.ts'
    );

    const command = buildCuckooFilterInsertCommand('CF.INSERT', 'key', ['a'], {
      capacity: 500,
      nocreate: true,
    });

    assert.deepStrictEqual(command, [
      'CF.INSERT',
      'key',
      'NOCREATE',
      'ITEMS',
      'a',
    ]);
  });
});

/** Stream value type and consumer-group lifecycle. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
} from '../utils/index.ts';

import type { FeaturedClient, ServerCapabilities } from '../utils/client.ts';

describe('streams', () => {
  let client: FeaturedClient;
  let capabilities: ServerCapabilities;
  let atLeast7 = false;
  const keyspace = createKeyspace('streams');

  before(async () => {
    client = await createClient();
    capabilities = await detectServerCapabilities(client);
    atLeast7 = capabilities.atLeast(7, 0);
  });

  after(async () => {
    await closeClient(client);
  });

  it('appends entries and reports length', async () => {
    const key = keyspace.key('append');

    const firstId = await client.xadd(key, '*', { sensor: '1', value: '10' });
    const secondId = await client.xadd(key, '*', { sensor: '1', value: '20' });

    assert.match(firstId, /^\d+-\d+$/);
    assert.match(secondId, /^\d+-\d+$/);
    assert.ok(firstId < secondId);
    assert.strictEqual(await client.xlen(key), 2);
  });

  it('reads entries with XRANGE and XREVRANGE', async () => {
    const key = keyspace.key('range');

    await client.xadd(key, '1-1', { value: 'a' });
    await client.xadd(key, '2-1', { value: 'b' });
    await client.xadd(key, '3-1', { value: 'c' });

    const forward = await client.xrange(key, '-', '+');

    assert.deepStrictEqual(
      forward.map((entry) => entry.id),
      ['1-1', '2-1', '3-1'],
    );
    assert.deepStrictEqual(forward[0].fields, { value: 'a' });

    const reverse = await client.xrevrange(key, '+', '-');

    assert.deepStrictEqual(
      reverse.map((entry) => entry.id),
      ['3-1', '2-1', '1-1'],
    );
    assert.deepStrictEqual(reverse[0].fields, { value: 'c' });
    assert.deepStrictEqual(reverse[1].fields, { value: 'b' });
    assert.deepStrictEqual(reverse[2].fields, { value: 'a' });
  });

  it('reads new entries with XREAD', async () => {
    const key = keyspace.key('xread');

    await client.xadd(key, '1-1', { value: 'first' });
    await client.xadd(key, '2-1', { value: 'second' });

    const result = await client.xread([key], ['0']);

    if (result === null) {
      assert.fail('expected non-null xread result');
    }
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].stream, key);
    assert.strictEqual(result[0].entries.length, 2);
    assert.deepStrictEqual(result[0].entries[0].fields, { value: 'first' });
    assert.deepStrictEqual(result[0].entries[1].fields, { value: 'second' });

    const empty = await client.xread([key], ['$']);

    assert.strictEqual(empty, null);
  });

  it('deletes and trims entries', async () => {
    const key = keyspace.key('trim');

    const ids: string[] = [];

    for (let index = 0; index < 10; index += 1) {
      ids.push(await client.xadd(key, '*', { index: `${index}` }));
    }

    assert.strictEqual(await client.xdel(key, ids[0], ids[1]), 2);
    assert.strictEqual(await client.xlen(key), 8);

    assert.strictEqual(await client.xtrim(key, 5), 3);
    assert.strictEqual(await client.xlen(key), 5);
  });

  it('introspects a stream with XINFO STREAM', async () => {
    const key = keyspace.key('info');

    await client.xadd(key, '1-1', { value: 'a' });
    await client.xadd(key, '2-1', { value: 'b' });

    const info = await client.xinfoStream(key);

    assert.strictEqual(info.length, 2);
    assert.strictEqual(info.lastGeneratedId, '2-1');
    if (info.firstEntry === undefined || info.firstEntry === null) {
      assert.fail('expected non-null firstEntry');
    }
    assert.strictEqual(info.firstEntry.id, '1-1');
    assert.deepStrictEqual(info.firstEntry.fields, { value: 'a' });
    if (info.lastEntry === undefined || info.lastEntry === null) {
      assert.fail('expected non-null lastEntry');
    }
    assert.strictEqual(info.lastEntry.id, '2-1');
    assert.deepStrictEqual(info.lastEntry.fields, { value: 'b' });
    assert.strictEqual(info.groups, 0);
  });

  it('drives a consumer group end to end', async () => {
    const key = keyspace.key('group', 'stream');
    const group = 'workers';
    const consumer = 'worker-1';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xadd(key, '2-1', { task: 'b' });

    assert.strictEqual(await client.xgroupCreate(key, group, '0'), 'OK');

    const delivered = await client.xreadgroup(group, consumer, [key], ['>']);

    if (delivered === null) {
      assert.fail('expected non-null xreadgroup result');
    }
    assert.strictEqual(delivered[0].entries.length, 2);

    const pendingBefore = await client.xpending(key, group);

    if (Array.isArray(pendingBefore)) {
      assert.fail('expected xpending summary, not entries array');
    }
    assert.strictEqual(pendingBefore.pending, 2);

    assert.strictEqual(await client.xack(key, group, ['1-1', '2-1']), 2);

    const remaining = await client.xpending(key, group, '-', '+', 10);

    assert.deepStrictEqual(remaining, []);
  });

  it('lists pending entries in detail', async () => {
    const key = keyspace.key('pending', 'stream');
    const group = 'group';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xgroupCreate(key, group, '0');
    await client.xreadgroup(group, 'consumer', [key], ['>']);

    const entries = await client.xpending(key, group, '-', '+', 10);

    if (!Array.isArray(entries)) {
      assert.fail('expected xpending entries array, not summary');
    }
    assert.strictEqual(entries[0].id, '1-1');
  });

  it('claims entries with XCLAIM', async () => {
    const key = keyspace.key('xclaim');
    const group = 'workers';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xadd(key, '2-1', { task: 'b' });
    await client.xgroupCreate(key, group, '0');
    await client.xreadgroup(group, 'worker-1', [key], ['>']);

    const claimed = await client.xclaim(key, group, 'worker-2', 0, ['1-1']);

    assert.strictEqual(claimed.length, 1);

    const entry = claimed[0];

    if (typeof entry === 'string') {
      assert.fail('expected stream entry object, not id string');
    }
    assert.strictEqual(entry.id, '1-1');
    assert.deepStrictEqual(entry.fields, { task: 'a' });
  });

  it('auto-claims entries with XAUTOCLAIM', async () => {
    const key = keyspace.key('xautoclaim');
    const group = 'workers';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xadd(key, '2-1', { task: 'b' });
    await client.xgroupCreate(key, group, '0');
    await client.xreadgroup(group, 'worker-1', [key], ['>']);

    const result = await client.xautoclaim(key, group, 'worker-2', 0, '0-0');

    assert.strictEqual(result.nextId, '0-0');
    assert.strictEqual(result.entries.length, 2);
    assert.strictEqual(result.entries[0].id, '1-1');
  });

  it('creates and removes consumers with XGROUP CREATECONSUMER / DELCONSUMER', async () => {
    const key = keyspace.key('xgroup-consumer');
    const group = 'workers';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xgroupCreate(key, group, '0');

    assert.strictEqual(
      await client.xgroupCreateconsumer(key, group, 'new-consumer'),
      1,
    );

    const deleted = await client.xgroupDelconsumer(key, group, 'new-consumer');

    assert.strictEqual(deleted, 0);
  });

  it('destroys a group with XGROUP DESTROY', async () => {
    const key = keyspace.key('xgroup-destroy');
    const group = 'temporary';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xgroupCreate(key, group, '0');

    assert.strictEqual(await client.xgroupDestroy(key, group), 1);
  });

  it('updates group last-delivered-id with XGROUP SETID', async () => {
    const key = keyspace.key('xgroup-setid');
    const group = 'workers';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xadd(key, '2-1', { task: 'b' });
    await client.xgroupCreate(key, group, '0');

    assert.strictEqual(await client.xgroupSetid(key, group, '1-1'), 'OK');

    const delivered = await client.xreadgroup(group, 'worker', [key], ['>']);

    if (delivered === null) {
      assert.fail('expected non-null xreadgroup result');
    }
    assert.strictEqual(delivered[0].entries.length, 1);
    assert.strictEqual(delivered[0].entries[0].id, '2-1');
  });

  it('lists group information with XINFO GROUPS', async () => {
    const key = keyspace.key('xinfo-groups');
    const group = 'analytics';

    await client.xadd(key, '1-1', { event: 'click' });
    await client.xgroupCreate(key, group, '0');

    const groups = await client.xinfoGroups(key);

    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].name, group);
    assert.strictEqual(groups[0].consumers, 0);
    assert.strictEqual(groups[0].pending, 0);
  });

  it('lists consumer information with XINFO CONSUMERS', async () => {
    const key = keyspace.key('xinfo-consumers');
    const group = 'workers';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xgroupCreate(key, group, '0');
    await client.xreadgroup(group, 'consumer-1', [key], ['>']);

    const consumers = await client.xinfoConsumers(key, group);

    assert.strictEqual(consumers.length, 1);
    assert.strictEqual(consumers[0].name, 'consumer-1');
    assert.strictEqual(consumers[0].pending, 1);
  });

  it('resets a stream last-entry-id with XSETID', async () => {
    const key = keyspace.key('xsetid');

    await client.xadd(key, '5-0', { value: 'a' });

    assert.strictEqual(await client.xsetid(key, '10-0'), 'OK');

    const id = await client.xadd(key, '*', { value: 'b' });

    const [milliseconds, sequence] = id.split('-');

    assert.ok(Number(milliseconds) > 10);
    assert.strictEqual(sequence, '0');
  });

  it('introspects full stream detail with XINFO STREAM FULL', async () => {
    const key = keyspace.key('info-full');
    const group = 'analysis';

    await client.xadd(key, '1-1', { value: 'a' });
    await client.xadd(key, '2-1', { value: 'b' });
    await client.xgroupCreate(key, group, '0');
    await client.xreadgroup(group, 'consumer-1', [key], ['>']);

    const info = await client.xinfoStream(key, true);

    if (!('entries' in info)) {
      assert.fail('expected full stream info with entries property');
    }
    assert.strictEqual(info.length, 2);
    assert.strictEqual(info.entries.length, 2);
    assert.strictEqual(info.groups.length, 1);

    const detail = info.groups[0];

    assert.strictEqual(detail.name, group);
    assert.strictEqual(detail.consumers.length, 1);
    assert.strictEqual(detail.consumers[0].name, 'consumer-1');
  });

  it('introspects full stream with COUNT option', async () => {
    const key = keyspace.key('info-full-count');

    for (let index = 0; index < 5; index += 1) {
      await client.xadd(key, '*', { index: `${index}` });
    }

    const info = await client.xinfoStream(key, true, 2);

    if (!('entries' in info)) {
      assert.fail('expected full stream info with entries property');
    }
    assert.strictEqual(info.entries.length, 2);
  });

  it('reads multiple streams with XREAD COUNT option', async () => {
    const keyA = keyspace.key('xread-multi-a');
    const keyB = keyspace.key('xread-multi-b');

    await client.xadd(keyA, '1-1', { source: 'a' });
    await client.xadd(keyA, '2-1', { source: 'a' });
    await client.xadd(keyB, '1-1', { source: 'b' });

    const result = await client.xread([keyA, keyB], ['0', '0'], 10);

    if (result === null) {
      assert.fail('expected non-null xread result');
    }
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].entries.length, 2);
    assert.strictEqual(result[1].entries.length, 1);
  });

  it('reads from group with COUNT and NOACK options', async () => {
    const key = keyspace.key('xreadgroup-opts');
    const group = 'opts-group';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xadd(key, '2-1', { task: 'b' });
    await client.xadd(key, '3-1', { task: 'c' });
    await client.xgroupCreate(key, group, '0');

    const result = await client.xreadgroup(
      group,
      'worker',
      [key],
      ['>'],
      2,
      undefined,
      true,
    );

    if (result === null) {
      assert.fail('expected non-null xreadgroup result');
    }
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].entries.length, 2);

    const pending = await client.xpending(key, group);

    if (Array.isArray(pending)) {
      assert.fail('expected xpending summary, not entries array');
    }
    assert.strictEqual(pending.pending, 0);
  });

  it('filters pending entries by consumer', async () => {
    const key = keyspace.key('pending-filter');
    const group = 'group';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xadd(key, '2-1', { task: 'b' });
    await client.xgroupCreate(key, group, '0');
    await client.xreadgroup(group, 'worker-a', [key], ['>'], 1);
    await client.xreadgroup(group, 'worker-b', [key], ['>'], 1);

    const entries = await client.xpending(key, group, '-', '+', 10, 'worker-a');

    if (!Array.isArray(entries)) {
      assert.fail('expected xpending entries array, not summary');
    }
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].id, '1-1');
  });

  it('claims entries with XCLAIM IDLE and FORCE options', async () => {
    const key = keyspace.key('xclaim-opts');
    const group = 'workers';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xgroupCreate(key, group, '0');
    await client.xreadgroup(group, 'worker-1', [key], ['>']);

    const claimed = await client.xclaim(key, group, 'worker-2', 0, ['1-1'], {
      idle: 0,
      force: true,
    });

    assert.strictEqual(claimed.length, 1);

    const entry = claimed[0];

    if (typeof entry === 'string') {
      assert.fail('expected stream entry object, not id string');
    }
    assert.strictEqual(entry.id, '1-1');
    assert.deepStrictEqual(entry.fields, { task: 'a' });
  });

  it('auto-claims entries with COUNT option', async () => {
    const key = keyspace.key('xautoclaim-count');
    const group = 'workers';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xadd(key, '2-1', { task: 'b' });
    await client.xadd(key, '3-1', { task: 'c' });
    await client.xgroupCreate(key, group, '0');
    await client.xreadgroup(group, 'worker-1', [key], ['>']);

    const result = await client.xautoclaim(key, group, 'worker-2', 0, '0-0', 2);

    assert.strictEqual(result.nextId, '3-1');
    assert.strictEqual(result.entries.length, 2);
    assert.strictEqual(result.entries[0].id, '1-1');
    assert.strictEqual(result.entries[1].id, '2-1');
  });

  it('creates a group with MKSTREAM on non-existing key', async () => {
    const key = keyspace.key('mkstream');
    const group = 'auto-created';

    assert.strictEqual(await client.xgroupCreate(key, group, '$', true), 'OK');

    await client.xadd(key, '*', { val: '1' });

    assert.strictEqual(await client.xlen(key), 1);
  });

  it('creates a group with ENTRIESREAD hint', async (context) => {
    if (!atLeast7) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('entriesread');

    await client.xadd(key, '1-1', { val: 'a' });
    await client.xadd(key, '2-1', { val: 'b' });

    assert.strictEqual(
      await client.xgroupCreate(key, 'grp', '0', false, 1),
      'OK',
    );

    const groups = await client.xinfoGroups(key);

    assert.strictEqual(groups[0].entriesRead, 1);
    if (capabilities.isValkey) {
      assert.strictEqual(groups[0].lag, 1);
    } else {
      assert.strictEqual(groups[0].lag, 2);
    }
  });

  it('sets stream id with ENTRIESADDED and MAXDELETEDID', async (context) => {
    if (!atLeast7) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('xsetid-opts');

    await client.xadd(key, '1-1', { val: 'a' });

    assert.strictEqual(await client.xsetid(key, '5-0', 10, '3-0'), 'OK');

    const info = await client.xinfoStream(key);

    assert.strictEqual(info.lastGeneratedId, '5-0');
    assert.strictEqual(info.maxDeletedEntryId, '3-0');
    assert.strictEqual(info.entriesAdded, 10);
  });

  it('reads pending entries with IDLE filter', async () => {
    const key = keyspace.key('pending-idle');
    const group = 'grp';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xadd(key, '2-1', { task: 'b' });
    await client.xgroupCreate(key, group, '0');
    await client.xreadgroup(group, 'worker', [key], ['>']);

    const entries = await client.xpending(
      key,
      group,
      '-',
      '+',
      10,
      undefined,
      0,
    );

    if (!Array.isArray(entries)) {
      assert.fail('expected xpending entries array, not summary');
    }
    assert.strictEqual(entries.length, 2);
    assert.deepStrictEqual(
      entries.map((entry) => entry.id),
      ['1-1', '2-1'],
    );
  });

  it('claims entries with TIME and RETRYCOUNT options', async () => {
    const key = keyspace.key('xclaim-time');
    const group = 'workers';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xgroupCreate(key, group, '0');
    await client.xreadgroup(group, 'worker-1', [key], ['>']);

    const claimed = await client.xclaim(key, group, 'worker-2', 0, ['1-1'], {
      time: Date.now(),
      retrycount: 5,
    });

    assert.strictEqual(claimed.length, 1);
    if (typeof claimed[0] === 'string') {
      assert.fail('expected stream entry object, not id string');
    }
    assert.strictEqual(claimed[0].id, '1-1');
    assert.deepStrictEqual(claimed[0].fields, { task: 'a' });

    const pending = await client.xpending(key, group, '-', '+', 10);

    if (!Array.isArray(pending)) {
      assert.fail('expected xpending entries array, not summary');
    }
    assert.strictEqual(pending[0].consumer, 'worker-2');
    assert.strictEqual(pending[0].deliveryCount, 5);
  });

  it('reads from group with BLOCK timeout', async () => {
    const key = keyspace.key('xreadgroup-block');
    const group = 'grp';

    await client.xadd(key, '1-1', { val: 'a' });
    await client.xgroupCreate(key, group, '0');

    const result = await client.xreadgroup(
      group,
      'worker',
      [key],
      ['>'],
      10,
      10,
    );

    if (result === null) {
      assert.fail('expected non-null xreadgroup result');
    }
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0].entries, [
      { id: '1-1', fields: { val: 'a' } },
    ]);
  });

  it('returns null from XREAD with BLOCK on empty stream', async () => {
    const key = keyspace.key('xread-block-empty');

    await client.xadd(key, '1-1', { val: 'a' });

    const result = await client.xread([key], ['$'], undefined, 10);

    assert.strictEqual(result, null);
  });

  it('throws on mismatched XREAD keys/ids', async () => {
    await assert.rejects(() => client.xread(['a', 'b'], ['0']), {
      message: '[XREAD] Keys and IDs must have the same length',
    });
  });

  it('throws on mismatched XREADGROUP keys/ids', async () => {
    await assert.rejects(() => client.xreadgroup('g', 'c', ['a', 'b'], ['0']), {
      message: '[XREADGROUP] Keys and IDs must have the same length',
    });
  });

  it('returns null from XREADGROUP BLOCK on consumed stream', async () => {
    const key = keyspace.key('xreadgroup-block-null');
    const group = 'grp';

    await client.xadd(key, '1-1', { val: 'a' });
    await client.xgroupCreate(key, group, '0');
    await client.xreadgroup(group, 'w', [key], ['>']);

    const result = await client.xreadgroup(
      group,
      'w',
      [key],
      ['>'],
      undefined,
      10,
    );

    assert.strictEqual(result, null);
  });

  it('sets group id with ENTRIESREAD option', async (context) => {
    if (!atLeast7) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('xgroup-setid-entriesread');
    const group = 'grp';

    await client.xadd(key, '1-1', { val: 'a' });
    await client.xadd(key, '2-1', { val: 'b' });
    await client.xgroupCreate(key, group, '0');

    assert.strictEqual(await client.xgroupSetid(key, group, '1-1', 1), 'OK');

    const groups = await client.xinfoGroups(key);

    assert.strictEqual(groups[0].lastDeliveredId, '1-1');
    assert.strictEqual(groups[0].entriesRead, 1);

    const delivered = await client.xreadgroup(group, 'worker', [key], ['>']);

    if (delivered === null) {
      assert.fail('expected non-null xreadgroup result');
    }
    assert.strictEqual(delivered[0].entries.length, 1);
    assert.strictEqual(delivered[0].entries[0].id, '2-1');
  });

  it('claims entry ids with XCLAIM JUSTID', async () => {
    const key = keyspace.key('xclaim-justid');
    const group = 'workers';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xgroupCreate(key, group, '0');
    await client.xreadgroup(group, 'worker-1', [key], ['>']);

    const result = await client.xclaim(key, group, 'worker-2', 0, ['1-1'], {
      justid: true,
    });

    assert.deepStrictEqual(result, ['1-1']);
  });

  it('auto-claims with JUSTID flag', async () => {
    const key = keyspace.key('xautoclaim-justid');
    const group = 'workers';

    await client.xadd(key, '1-1', { task: 'a' });
    await client.xgroupCreate(key, group, '0');
    await client.xreadgroup(group, 'worker-1', [key], ['>']);

    const result = await client.xautoclaim(
      key,
      group,
      'worker-2',
      0,
      '0-0',
      undefined,
      true,
    );

    assert.strictEqual(result.nextId, '0-0');
    assert.deepStrictEqual(result.entries, [{ id: '1-1', fields: {} }]);
  });

  it('uses XPENDING with consumer filter and idle', async () => {
    const key = keyspace.key('xpending-consumer-idle');
    const group = 'workers';

    await client.xadd(key, '1-1', { val: 'a' });
    await client.xadd(key, '2-1', { val: 'b' });
    await client.xgroupCreate(key, group, '0');
    await client.xreadgroup(group, 'w1', [key], ['>']);

    const pending = await client.xpending(key, group, '-', '+', 10, 'w1');

    if (!Array.isArray(pending)) {
      assert.fail('expected xpending entries array, not summary');
    }
    assert.strictEqual(pending.length, 2);
    assert.deepStrictEqual(
      pending.map(({ id, consumer, deliveryCount }) => ({
        id,
        consumer,
        deliveryCount,
      })),
      [
        { id: '1-1', consumer: 'w1', deliveryCount: 1 },
        { id: '2-1', consumer: 'w1', deliveryCount: 1 },
      ],
    );
    assert.strictEqual(pending[0].deliveryTime, pending[1].deliveryTime);
    assert.strictEqual(pending[0].deliveryCount, 1);
    assert.strictEqual(pending[1].deliveryCount, 1);
    assert.strictEqual(typeof pending[0].deliveryTime, 'number');
    assert.strictEqual(typeof pending[1].deliveryTime, 'number');
  });

  it('returns XPENDING summary with consumer breakdown', async () => {
    const key = keyspace.key('xpending-summary');
    const group = 'summary-group';

    const firstId = await client.xadd(key, '*', { v: '1' });
    const secondId = await client.xadd(key, '*', { v: '2' });
    await client.xgroupCreate(key, group, '0');
    await client.xreadgroup(group, 'reader', [key], ['>']);

    const summary = await client.xpending(key, group);

    if (Array.isArray(summary)) {
      assert.fail('expected xpending summary, not entries array');
    }
    assert.strictEqual(summary.pending, 2);
    assert.strictEqual(summary.minId, firstId);
    assert.strictEqual(summary.maxId, secondId);
    assert.deepStrictEqual(summary.consumers, [{ name: 'reader', count: 2 }]);
  });
});

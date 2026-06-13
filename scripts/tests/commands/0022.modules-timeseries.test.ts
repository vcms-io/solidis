/**
 * RedisTimeSeries (TS.*) commands. Gated on module availability so the suite
 * self-skips without RedisTimeSeries.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  isCommandSupported,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('modules-timeseries', () => {
  let client: FeaturedClient;
  let available = false;
  const keyspace = createKeyspace('timeseries');

  before(async () => {
    client = await createClient();
    available = await isCommandSupported(client, ['TS.CREATE']);
  });

  after(async () => {
    await closeClient(client);
  });

  it('creates a series and appends samples', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('series');

    assert.strictEqual(
      await client.tsCreate(key, { labels: { sensor: 'temperature' } }),
      'OK',
    );

    assert.strictEqual(await client.tsAdd(key, 1000, 25.5), 1000);
    assert.strictEqual(await client.tsAdd(key, 2000, 26.0), 2000);
  });

  it('reads the latest sample with TS.GET', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('latest');

    await client.tsCreate(key);
    await client.tsAdd(key, 1000, 10);
    await client.tsAdd(key, 2000, 20);

    const latest = await client.tsGet(key);

    assert.deepStrictEqual(latest, [2000, 20]);
  });

  it('queries a range of samples', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('range');

    await client.tsCreate(key);
    await client.tsAdd(key, 1000, 1);
    await client.tsAdd(key, 2000, 2);
    await client.tsAdd(key, 3000, 3);

    const samples = await client.tsRange(key, 1000, 2000);

    assert.deepStrictEqual(samples, [
      { timestamp: 1000, value: 1 },
      { timestamp: 2000, value: 2 },
    ]);
  });

  it('aggregates a range into buckets', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('aggregate');

    await client.tsCreate(key);
    await client.tsAdd(key, 1000, 1);
    await client.tsAdd(key, 1500, 3);
    await client.tsAdd(key, 2000, 5);

    const buckets = await client.tsRange(key, 0, 3000, {
      aggregation: { type: 'avg', bucketDuration: 1000 },
    });

    assert.ok(buckets.length > 0);
    assert.strictEqual(typeof buckets[0].value, 'number');
  });

  it('increments a compacted counter series', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('counter');

    await client.tsCreate(key);

    const firstTimestamp = await client.tsIncrby(key, 5);
    const secondTimestamp = await client.tsIncrby(key, 3);

    assert.strictEqual(typeof firstTimestamp, 'number');
    assert.ok(secondTimestamp >= firstTimestamp);

    const latest = await client.tsGet(key);

    assert.strictEqual(latest?.[1], 8);
  });

  it('decrements a counter series with TS.DECRBY', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('decrby');

    await client.tsCreate(key);
    await client.tsIncrby(key, 10);

    const ts = await client.tsDecrby(key, 3);

    assert.strictEqual(typeof ts, 'number');

    const latest = await client.tsGet(key);

    assert.strictEqual(latest?.[1], 7);
  });

  it('deletes samples in a range with TS.DEL', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('del');

    await client.tsCreate(key);
    await client.tsAdd(key, 1000, 1);
    await client.tsAdd(key, 2000, 2);
    await client.tsAdd(key, 3000, 3);

    const deleted = await client.tsDel(key, 1000, 2000);

    assert.strictEqual(deleted, 2);

    const remaining = await client.tsRange(key, 0, 4000);

    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].timestamp, 3000);
  });

  it('adds multiple samples with TS.MADD', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('madd');

    await client.tsCreate(key);

    const timestamps = await client.tsMadd(key, [
      { timestamp: 1000, value: 10 },
      { timestamp: 2000, value: 20 },
      { timestamp: 3000, value: 30 },
    ]);

    assert.deepStrictEqual(timestamps, [1000, 2000, 3000]);

    const samples = await client.tsRange(key, 0, 4000);

    assert.strictEqual(samples.length, 3);
  });

  it('queries samples in reverse with TS.REVRANGE', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('revrange');

    await client.tsCreate(key);
    await client.tsAdd(key, 1000, 1);
    await client.tsAdd(key, 2000, 2);
    await client.tsAdd(key, 3000, 3);

    const samples = await client.tsRevrange(key, 1000, 3000);

    assert.strictEqual(samples.length, 3);
    assert.strictEqual(samples[0].timestamp, 3000);
    assert.strictEqual(samples[2].timestamp, 1000);
  });

  it('reports series information with TS.INFO', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('info');

    await client.tsCreate(key, { labels: { env: 'test' } });
    await client.tsAdd(key, 1000, 42);

    const info = await client.tsInfo(key);

    assert.strictEqual(typeof info, 'object');
    assert.strictEqual(info.totalSamples, 1);
    assert.strictEqual(info.firstTimestamp, 1000);
    assert.strictEqual(info.lastTimestamp, 1000);
  });

  it('alters series metadata with TS.ALTER', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('alter');

    await client.tsCreate(key, { labels: { env: 'dev' } });

    assert.strictEqual(
      await client.tsAlter(key, { labels: { env: 'prod' } }),
      'OK',
    );
  });

  it('creates and deletes compaction rules with TS.CREATERULE / TS.DELETERULE', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const sourceKey = keyspace.key('rule-source');
    const destinationKey = keyspace.key('rule-destination');

    await client.tsCreate(sourceKey);
    await client.tsCreate(destinationKey);

    assert.strictEqual(
      await client.tsCreaterule(sourceKey, destinationKey, {
        aggregation: { type: 'avg', bucketDuration: 60000 },
      }),
      'OK',
    );

    assert.strictEqual(
      await client.tsDeleterule(sourceKey, destinationKey),
      'OK',
    );
  });

  it('queries multiple series with TS.MGET', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('mget');

    await client.tsCreate(key, { labels: { region: 'east', role: 'mget' } });
    await client.tsAdd(key, 1000, 42);

    const results = await client.tsMget({ role: 'mget' });

    assert.ok(Array.isArray(results));
    assert.ok(results.length >= 1);
    assert.strictEqual(typeof results[0].key, 'string');
    assert.strictEqual(typeof results[0].timestamp, 'number');
    assert.strictEqual(typeof results[0].value, 'number');
  });

  it('queries multiple series across a range with TS.MRANGE', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('mrange');

    await client.tsCreate(key, { labels: { region: 'west', role: 'mrange' } });
    await client.tsAdd(key, 1000, 10);
    await client.tsAdd(key, 2000, 20);
    await client.tsAdd(key, 3000, 30);

    const results = await client.tsMrange(1000, 3000, { role: 'mrange' });

    assert.ok(Array.isArray(results));
    assert.ok(results.length >= 1);
    assert.strictEqual(typeof results[0].key, 'string');
    assert.ok(results[0].samples.length >= 1);
    assert.strictEqual(typeof results[0].samples[0].timestamp, 'number');
    assert.strictEqual(typeof results[0].samples[0].value, 'number');
  });

  it('queries multiple series in reverse with TS.MREVRANGE', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('mrevrange');

    await client.tsCreate(key, {
      labels: { region: 'north', role: 'mrevrange' },
    });
    await client.tsAdd(key, 1000, 5);
    await client.tsAdd(key, 2000, 15);

    const results = await client.tsMrevrange(1000, 2000, { role: 'mrevrange' });

    assert.ok(Array.isArray(results));
    assert.ok(results.length >= 1);
    assert.ok(results[0].samples.length >= 1);
  });

  it('finds series keys by labels with TS.QUERYINDEX', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('queryindex');

    await client.tsCreate(key, {
      labels: { env: 'staging', role: 'queryindex' },
    });

    const keys = await client.tsQueryindex({ role: 'queryindex' });

    assert.ok(Array.isArray(keys));
    assert.ok(keys.includes(key));
  });

  it('gets latest sample with TS.GET LATEST option', async (context) => {
    if (!available) {
      context.skip('RedisTimeSeries not loaded');
      return;
    }

    const key = keyspace.key('ts-get-latest');

    await client.tsCreate(key);
    await client.tsAdd(key, 5000, 42);

    const result = await client.tsGet(key, true);

    /** TS.GET returns the most recent [timestamp, value] pair. */
    assert.deepStrictEqual(result, [5000, 42]);
  });

  it('rejects TS.GET on missing key', async (context) => {
    if (!available) {
      context.skip('RedisTimeSeries not loaded');
      return;
    }

    await assert.rejects(
      () => client.tsGet(keyspace.key('ts-get-missing')),
      (error: Error) => error.message.includes('does not exist'),
    );
  });

  it('creates a rule with alignTimestamp', async (context) => {
    if (!available) {
      context.skip('RedisTimeSeries not loaded');
      return;
    }

    const source = keyspace.key('ts-rule-align-src');
    const destination = keyspace.key('ts-rule-align-dst');

    await client.tsCreate(source);
    await client.tsCreate(destination);

    assert.strictEqual(
      await client.tsCreaterule(source, destination, {
        aggregation: { type: 'avg', bucketDuration: 60000, alignTimestamp: 0 },
      }),
      'OK',
    );
  });

  it('queries TS.MGET with LATEST option', async (context) => {
    if (!available) {
      context.skip('RedisTimeSeries not loaded');
      return;
    }

    const key = keyspace.key('ts-mget-latest');

    await client.tsCreate(key, { labels: { sensor: 'temp' } });
    await client.tsAdd(key, Date.now(), 25);

    const result = await client.tsMget({ sensor: 'temp' }, { latest: true });

    assert.ok(Array.isArray(result));
  });

  it('queries TS.RANGE with FILTER_BY_VALUE and COUNT', async (context) => {
    if (!available) {
      context.skip('RedisTimeSeries not loaded');
      return;
    }

    const key = keyspace.key('ts-range-filter');

    await client.tsCreate(key);

    const now = Date.now();

    await client.tsAdd(key, now - 3000, 10);
    await client.tsAdd(key, now - 2000, 50);
    await client.tsAdd(key, now - 1000, 90);

    const samples = await client.tsRange(key, now - 4000, now, {
      filterByValue: [[20, 100]],
      count: 5,
    });

    assert.ok(Array.isArray(samples));
    assert.ok(samples.length >= 1);
    assert.ok(samples.every((s) => s.value >= 20));
  });

  it('queries TS.REVRANGE with LATEST and ALIGN', async (context) => {
    if (!available) {
      context.skip('RedisTimeSeries not loaded');
      return;
    }

    const key = keyspace.key('ts-revrange-opts');

    await client.tsCreate(key);

    const now = Date.now();

    await client.tsAdd(key, now - 2000, 5);
    await client.tsAdd(key, now - 1000, 15);

    const samples = await client.tsRevrange(key, now - 3000, now, {
      latest: true,
      count: 10,
    });

    assert.ok(Array.isArray(samples));
    assert.ok(samples.length >= 1);
  });

  it('queries TS.MRANGE with FILTER_BY_VALUE', async (context) => {
    if (!available) {
      context.skip('RedisTimeSeries not loaded');
      return;
    }

    const key = keyspace.key('ts-mrange-filter');

    await client.tsCreate(key, { labels: { device: 'mr-filter' } });

    const now = Date.now();

    await client.tsAdd(key, now - 2000, 30);
    await client.tsAdd(key, now - 1000, 70);

    const results = await client.tsMrange(
      now - 3000,
      now,
      { device: 'mr-filter' },
      { filterByValue: [[50, 100]], count: 10 },
    );

    assert.ok(Array.isArray(results));
  });

  it('queries TS.MREVRANGE with AGGREGATION and ALIGN', async (context) => {
    if (!available) {
      context.skip('RedisTimeSeries not loaded');
      return;
    }

    const key = keyspace.key('ts-mrevrange-agg');

    await client.tsCreate(key, { labels: { unit: 'mrv-agg' } });

    const now = Date.now();

    await client.tsAdd(key, now - 3000, 10);
    await client.tsAdd(key, now - 2000, 20);
    await client.tsAdd(key, now - 1000, 30);

    const results = await client.tsMrevrange(
      now - 4000,
      now,
      { unit: 'mrv-agg' },
      {
        aggregation: { type: 'avg', bucketDuration: 2000 },
        align: 0,
      },
    );

    assert.ok(Array.isArray(results));
  });

  it('builds TS.RANGE createCommand with all options', async () => {
    const { createCommand } = await import(
      '../../../sources/command/ts.range.ts'
    );

    const command = createCommand('key', 0, 9999, {
      count: 10,
      aggregation: { type: 'avg', bucketDuration: 1000 },
      latest: true,
      align: 0,
      filterByTs: [[100, 200]],
      filterByValue: [[0, 100]],
    });

    assert.ok(command.includes('COUNT'));
    assert.ok(command.includes('AGGREGATION'));
    assert.ok(command.includes('LATEST'));
    assert.ok(command.includes('ALIGN'));
    assert.ok(command.includes('FILTER_BY_TS'));
    assert.ok(command.includes('FILTER_BY_VALUE'));
  });

  it('builds TS.REVRANGE createCommand with options', async () => {
    const { createCommand } = await import(
      '../../../sources/command/ts.revrange.ts'
    );

    const command = createCommand('key', 0, 9999, {
      filterByValue: [[10, 50]],
      aggregation: { type: 'max', bucketDuration: 2000 },
    });

    assert.ok(command.includes('TS.REVRANGE'));
    assert.ok(command.includes('FILTER_BY_VALUE'));
    assert.ok(command.includes('AGGREGATION'));
  });

  it('builds TS.CREATE with all options via buildTimeSeriesCommand', async () => {
    const { buildTimeSeriesCommand } = await import(
      '../../../sources/command/utils/command.ts'
    );

    const command = buildTimeSeriesCommand(['TS.CREATE', 'key'], {
      retention: 60000,
      encoding: 'COMPRESSED',
      chunkSize: 4096,
      duplicatePolicy: 'LAST',
      labels: { sensor: 'temp', location: 'room' },
      ignore: { maxTimediff: 1000, maxValDiff: 5 },
    });

    assert.ok(command.includes('RETENTION'));
    assert.ok(command.includes('60000'));
    assert.ok(command.includes('ENCODING'));
    assert.ok(command.includes('COMPRESSED'));
    assert.ok(command.includes('CHUNK_SIZE'));
    assert.ok(command.includes('4096'));
    assert.ok(command.includes('DUPLICATE_POLICY'));
    assert.ok(command.includes('LAST'));
    assert.ok(command.includes('LABELS'));
    assert.ok(command.includes('IGNORE'));
  });

  it('builds TS.ADD with ON_DUPLICATE via buildTimeSeriesCommand', async () => {
    const { buildTimeSeriesCommand } = await import(
      '../../../sources/command/utils/command.ts'
    );

    const command = buildTimeSeriesCommand(['TS.ADD', 'key', '1000', '5'], {
      onDuplicate: 'SUM',
    });

    assert.ok(command.includes('ON_DUPLICATE'));
    assert.ok(command.includes('SUM'));
  });
});

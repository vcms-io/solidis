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

    assert.deepStrictEqual(buckets, [
      { timestamp: 1000, value: 2 },
      { timestamp: 2000, value: 5 },
    ]);
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

    assert.ok(secondTimestamp >= firstTimestamp);

    const latest = await client.tsGet(key);

    if (latest === null) {
      assert.fail('TS.GET must return the latest sample after TS.INCRBY');
    }

    assert.deepStrictEqual(latest, [secondTimestamp, 8]);
  });

  it('decrements a counter series with TS.DECRBY', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('decrby');

    await client.tsCreate(key);
    await client.tsIncrby(key, 10);

    await client.tsDecrby(key, 3);

    const latest = await client.tsGet(key);

    if (latest === null) {
      assert.fail('TS.GET must return the latest sample after TS.DECRBY');
    }

    assert.strictEqual(latest[1], 7);
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

    assert.deepStrictEqual(remaining, [{ timestamp: 3000, value: 3 }]);
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

    assert.deepStrictEqual(samples, [
      { timestamp: 1000, value: 10 },
      { timestamp: 2000, value: 20 },
      { timestamp: 3000, value: 30 },
    ]);
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

    assert.deepStrictEqual(samples, [
      { timestamp: 3000, value: 3 },
      { timestamp: 2000, value: 2 },
      { timestamp: 1000, value: 1 },
    ]);
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

    assert.strictEqual(info.totalSamples, 1);
    assert.strictEqual(info.firstTimestamp, 1000);
    assert.strictEqual(info.lastTimestamp, 1000);
    assert.ok(Array.isArray(info.labels));
    assert.deepStrictEqual(
      info.labels.map((pair: unknown) => {
        assert.ok(Array.isArray(pair) && pair.length === 2);
        return [String(pair[0]), String(pair[1])];
      }),
      [['env', 'test']],
    );
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

    const altered = await client.tsInfo(key);

    assert.ok(Array.isArray(altered.labels));
    assert.deepStrictEqual(
      altered.labels.map((pair: unknown) => {
        assert.ok(Array.isArray(pair) && pair.length === 2);
        return [String(pair[0]), String(pair[1])];
      }),
      [['env', 'prod']],
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

    const sourceInfo = await client.tsInfo(sourceKey);
    const destinationInfo = await client.tsInfo(destinationKey);

    assert.ok(Array.isArray(sourceInfo.rules));
    assert.strictEqual(sourceInfo.rules.length, 1);
    assert.strictEqual(String(sourceInfo.rules[0][0]), destinationKey);
    assert.strictEqual(sourceInfo.rules[0][1], 60000);
    assert.strictEqual(sourceInfo.rules[0][2], 'AVG');
    assert.strictEqual(sourceInfo.rules[0][3], 0);
    assert.strictEqual(String(destinationInfo.sourceKey), sourceKey);
    assert.deepStrictEqual(destinationInfo.rules, []);

    assert.strictEqual(
      await client.tsDeleterule(sourceKey, destinationKey),
      'OK',
    );

    assert.deepStrictEqual((await client.tsInfo(sourceKey)).rules, []);
    assert.strictEqual((await client.tsInfo(destinationKey)).sourceKey, null);
  });

  it('queries multiple series with TS.MGET', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('mget');
    const label = keyspace.key('mget-label');

    await client.tsCreate(key, { labels: { region: 'east', role: label } });
    await client.tsAdd(key, 1000, 42);

    const results = await client.tsMget({ role: label });

    assert.deepStrictEqual(results, [{ key, timestamp: 1000, value: 42 }]);
  });

  it('queries multiple series across a range with TS.MRANGE', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('mrange');
    const label = keyspace.key('mrange-label');

    await client.tsCreate(key, { labels: { region: 'west', role: label } });
    await client.tsAdd(key, 1000, 10);
    await client.tsAdd(key, 2000, 20);
    await client.tsAdd(key, 3000, 30);

    const results = await client.tsMrange(1000, 3000, { role: label });

    assert.deepStrictEqual(results, [
      {
        key,
        samples: [
          { timestamp: 1000, value: 10 },
          { timestamp: 2000, value: 20 },
          { timestamp: 3000, value: 30 },
        ],
      },
    ]);
  });

  it('queries multiple series in reverse with TS.MREVRANGE', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('mrevrange');
    const label = keyspace.key('mrevrange-label');

    await client.tsCreate(key, {
      labels: { region: 'north', role: label },
    });
    await client.tsAdd(key, 1000, 5);
    await client.tsAdd(key, 2000, 15);

    const results = await client.tsMrevrange(1000, 2000, { role: label });

    assert.deepStrictEqual(results, [
      {
        key,
        samples: [
          { timestamp: 2000, value: 15 },
          { timestamp: 1000, value: 5 },
        ],
      },
    ]);
  });

  it('finds series keys by labels with TS.QUERYINDEX', async (context) => {
    if (!available) {
      context.skip('module not loaded on this server');
      return;
    }

    const key = keyspace.key('queryindex');
    const label = keyspace.key('queryindex-label');

    await client.tsCreate(key, {
      labels: { env: 'staging', role: label },
    });

    const keys = await client.tsQueryindex({ role: label });

    assert.deepStrictEqual(keys, [key]);
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

    const missingKey = keyspace.key('ts-get-missing');

    await assert.rejects(() => client.tsGet(missingKey), {
      message: `[TS.GET ${missingKey}] Unexpected reply: RespError: ERR TSDB: the key does not exist`,
    });
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

    const sourceInfo = await client.tsInfo(source);

    assert.ok(Array.isArray(sourceInfo.rules));
    assert.strictEqual(sourceInfo.rules.length, 1);
    assert.strictEqual(String(sourceInfo.rules[0][0]), destination);
    assert.strictEqual(sourceInfo.rules[0][1], 60000);
    assert.strictEqual(sourceInfo.rules[0][2], 'AVG');
    assert.strictEqual(sourceInfo.rules[0][3], 0);
  });

  it('queries TS.MGET with LATEST option', async (context) => {
    if (!available) {
      context.skip('RedisTimeSeries not loaded');
      return;
    }

    const key = keyspace.key('ts-mget-latest');
    const label = keyspace.key('ts-mget-latest-label');

    await client.tsCreate(key, { labels: { sensor: label } });

    const timestamp = Date.now();

    await client.tsAdd(key, timestamp, 25);

    const result = await client.tsMget({ sensor: label }, { latest: true });

    assert.deepStrictEqual(result, [{ key, timestamp, value: 25 }]);
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

    assert.deepStrictEqual(samples, [
      { timestamp: now - 2000, value: 50 },
      { timestamp: now - 1000, value: 90 },
    ]);
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

    assert.deepStrictEqual(samples, [
      { timestamp: now - 1000, value: 15 },
      { timestamp: now - 2000, value: 5 },
    ]);
  });

  it('queries TS.MRANGE with FILTER_BY_VALUE', async (context) => {
    if (!available) {
      context.skip('RedisTimeSeries not loaded');
      return;
    }

    const key = keyspace.key('ts-mrange-filter');
    const label = keyspace.key('ts-mrange-filter-label');

    await client.tsCreate(key, { labels: { device: label } });

    const now = Date.now();

    await client.tsAdd(key, now - 2000, 30);
    await client.tsAdd(key, now - 1000, 70);

    const results = await client.tsMrange(
      now - 3000,
      now,
      { device: label },
      { filterByValue: [[50, 100]], count: 10 },
    );

    assert.deepStrictEqual(results, [
      {
        key,
        samples: [{ timestamp: now - 1000, value: 70 }],
      },
    ]);
  });

  it('queries TS.MREVRANGE with AGGREGATION and ALIGN', async (context) => {
    if (!available) {
      context.skip('RedisTimeSeries not loaded');
      return;
    }

    const key = keyspace.key('ts-mrevrange-agg');
    const label = keyspace.key('ts-mrevrange-agg-label');

    await client.tsCreate(key, { labels: { unit: label } });

    const now = Date.now();

    await client.tsAdd(key, now - 3000, 10);
    await client.tsAdd(key, now - 2000, 20);
    await client.tsAdd(key, now - 1000, 30);

    const results = await client.tsMrevrange(
      now - 4000,
      now,
      { unit: label },
      {
        aggregation: { type: 'avg', bucketDuration: 2000 },
        align: 0,
      },
    );

    const bucketDuration = 2000;
    const points = [
      { timestamp: now - 3000, value: 10 },
      { timestamp: now - 2000, value: 20 },
      { timestamp: now - 1000, value: 30 },
    ];
    const bucketValues = new Map<number, number[]>();

    for (const point of points) {
      const bucket =
        Math.floor(point.timestamp / bucketDuration) * bucketDuration;
      const values = bucketValues.get(bucket) ?? [];

      values.push(point.value);
      bucketValues.set(bucket, values);
    }

    const expectedSamples = [...bucketValues.entries()]
      .map(([timestamp, values]) => ({
        timestamp,
        value: values.reduce((sum, value) => sum + value, 0) / values.length,
      }))
      .sort((left, right) => right.timestamp - left.timestamp);

    assert.deepStrictEqual(results, [{ key, samples: expectedSamples }]);
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

    assert.deepStrictEqual(command, [
      'TS.RANGE',
      'key',
      '0',
      '9999',
      'FILTER_BY_TS',
      '100',
      '200',
      'FILTER_BY_VALUE',
      '0',
      '100',
      'COUNT',
      '10',
      'ALIGN',
      '0',
      'AGGREGATION',
      'avg',
      '1000',
      'LATEST',
    ]);
  });

  it('builds TS.REVRANGE createCommand with options', async () => {
    const { createCommand } = await import(
      '../../../sources/command/ts.revrange.ts'
    );

    const command = createCommand('key', 0, 9999, {
      filterByValue: [[10, 50]],
      aggregation: { type: 'max', bucketDuration: 2000 },
    });

    assert.deepStrictEqual(command, [
      'TS.REVRANGE',
      'key',
      '0',
      '9999',
      'FILTER_BY_VALUE',
      '10',
      '50',
      'AGGREGATION',
      'max',
      '2000',
    ]);
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

    assert.deepStrictEqual(command, [
      'TS.CREATE',
      'key',
      'RETENTION',
      '60000',
      'ENCODING',
      'COMPRESSED',
      'CHUNK_SIZE',
      '4096',
      'DUPLICATE_POLICY',
      'LAST',
      'LABELS',
      'sensor',
      'temp',
      'location',
      'room',
      'IGNORE',
      '1000',
      '5',
    ]);
  });

  it('builds TS.ADD with ON_DUPLICATE via buildTimeSeriesCommand', async () => {
    const { buildTimeSeriesCommand } = await import(
      '../../../sources/command/utils/command.ts'
    );

    const command = buildTimeSeriesCommand(['TS.ADD', 'key', '1000', '5'], {
      onDuplicate: 'SUM',
    });

    assert.deepStrictEqual(command, [
      'TS.ADD',
      'key',
      '1000',
      '5',
      'ON_DUPLICATE',
      'SUM',
    ]);
  });
});

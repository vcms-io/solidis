/**
 * RESP3 reply-shape coverage.
 *
 * The default test connection speaks RESP2. RESP3 changes the wire shape of
 * many replies — doubles arrive as native numbers, maps as `Map`, sets as
 * `Set`, and sorted-set members as nested `[member, score]` pairs. This suite
 * reconnects with `protocol: 'RESP3'` and asserts the client normalises every
 * one of those shapes to exactly the value a RESP2 caller would receive.
 *
 * These cases previously surfaced real parser bugs (ZPOPMIN/ZPOPMAX with COUNT,
 * ZMSCORE, GEOPOS, XINFO GROUPS, TS.INFO all threw on RESP3 shapes); the parsers
 * were fixed at the source and these assertions now guard against regressions.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  delay,
  detectServerCapabilities,
  isCommandSupported,
} from '../utils/index.ts';

import type { FeaturedClient, ServerCapabilities } from '../utils/index.ts';

describe('resp3-shapes', () => {
  let client: FeaturedClient;
  let capabilities: ServerCapabilities;
  let hasTimeSeries = false;
  let hasJson = false;
  let hasBloom = false;
  const keyspace = createKeyspace('resp3');

  before(async () => {
    client = await createClient({ protocol: 'RESP3' });
    capabilities = await detectServerCapabilities(client);
    hasTimeSeries = await isCommandSupported(client, ['TS.CREATE']);
    hasJson = await isCommandSupported(client, [
      'JSON.SET',
      '_probe',
      '$',
      '1',
    ]);
    hasBloom = await isCommandSupported(client, ['BF.ADD', '_probe', 'x']);
  });

  after(async () => {
    await closeClient(client);
  });

  it('normalises a RESP3 map reply from HGETALL', async () => {
    const key = keyspace.key('hgetall');

    await client.hset(key, 'a', '1');
    await client.hset(key, 'b', '2');

    assert.deepStrictEqual(await client.hgetall(key), { a: '1', b: '2' });
  });

  it('normalises a RESP3 map reply from CONFIG GET', async () => {
    const config = await client.configGet('maxmemory');

    assert.strictEqual(typeof config, 'object');
    assert.ok('maxmemory' in config);
  });

  it('reads RESP3 doubles from ZSCORE and ZINCRBY', async () => {
    const key = keyspace.key('zscore');

    await client.zadd(key, 1.5, 'm');

    assert.strictEqual(await client.zscore(key, 'm'), 1.5);
    assert.strictEqual(await client.zincrby(key, 2.5, 'm'), 4);
  });

  it('reads a RESP3 aggregate ZRANGE reply with scores', async () => {
    const key = keyspace.key('zrange');

    await client.zadd(key, 1, 'a');
    await client.zadd(key, 2, 'b');
    await client.zadd(key, 3, 'c');

    assert.deepStrictEqual(
      await client.zrange(key, '0', '-1', { withScores: true }),
      [
        { member: 'a', score: 1 },
        { member: 'b', score: 2 },
        { member: 'c', score: 3 },
      ],
    );
  });

  it('reads RESP3 nested-pair replies from ZPOPMIN and ZPOPMAX', async () => {
    const key = keyspace.key('zpop');

    await client.zadd(key, 1, 'a');
    await client.zadd(key, 2, 'b');
    await client.zadd(key, 3, 'c');

    assert.deepStrictEqual(await client.zpopmin(key, 2), [
      { member: 'a', score: 1 },
      { member: 'b', score: 2 },
    ]);

    assert.deepStrictEqual(await client.zpopmax(key, 1), [
      { member: 'c', score: 3 },
    ]);
  });

  it('reads a RESP3 ZMPOP reply', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('zmpop');

    await client.zadd(key, 1, 'a');
    await client.zadd(key, 2, 'b');

    const popped = await client.zmpop([key], 'MIN', 1);

    assert.ok(popped !== null);
    assert.strictEqual(popped.key, key);
    assert.deepStrictEqual(popped.elements, [{ member: 'a', score: 1 }]);
  });

  it('reads RESP3 double scores (and nils) from ZMSCORE', async () => {
    const key = keyspace.key('zmscore');

    await client.zadd(key, 2, 'b');

    assert.deepStrictEqual(await client.zmscore(key, ['b', 'missing']), [
      2,
      null,
    ]);
  });

  it('reads a RESP3 set reply from SMEMBERS', async () => {
    const key = keyspace.key('smembers');

    await client.sadd(key, 'x', 'y', 'z');

    const members = await client.smembers(key);

    assert.strictEqual(new Set(members).size, 3);
    assert.deepStrictEqual([...members].sort(), ['x', 'y', 'z']);
  });

  it('reads RESP3 GEO doubles from GEOPOS and GEODIST', async () => {
    const key = keyspace.key('geo');

    await client.geoadd(key, [
      { longitude: 13.361389, latitude: 38.115556, member: 'Palermo' },
      { longitude: 15.087269, latitude: 37.502669, member: 'Catania' },
    ]);

    const positions = await client.geopos(key, ['Palermo', 'absent']);

    assert.strictEqual(positions.length, 2);
    assert.ok(positions[0] !== null);
    assert.ok(Math.abs((positions[0]?.longitude ?? 0) - 13.361389) < 0.001);
    assert.ok(Math.abs((positions[0]?.latitude ?? 0) - 38.115556) < 0.001);
    assert.strictEqual(positions[1], null);

    const distance = await client.geodist(key, 'Palermo', 'Catania', 'KM');

    assert.ok(distance !== null && distance > 160 && distance < 170);
  });

  it('reads RESP3 stream introspection maps from XINFO', async () => {
    const key = keyspace.key('stream');

    await client.xadd(key, '1-1', { field: 'value' });
    await client.xgroupCreate(key, 'grp', '0');

    const info = await client.xinfoStream(key);

    assert.strictEqual(info.length, 1);
    assert.strictEqual(info.groups, 1);

    const groups = await client.xinfoGroups(key);

    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].name, 'grp');
    assert.strictEqual(groups[0].consumers, 0);
    assert.strictEqual(groups[0].pending, 0);
  });

  it('reads a RESP3 map from MEMORY STATS', async () => {
    const stats = await client.memoryStats();

    assert.strictEqual(typeof stats.total.allocated, 'number');
    assert.ok(stats.total.allocated > 0);
  });

  it('reads RESP3 TimeSeries replies when the module is present', async (context) => {
    if (!hasTimeSeries) {
      context.skip('RedisTimeSeries not loaded');
      return;
    }

    const key = keyspace.key('ts');

    await client.tsCreate(key, { labels: { kind: 'resp3' } });
    await client.tsAdd(key, 1000, 42);

    const info = await client.tsInfo(key);

    assert.strictEqual(info.totalSamples, 1);

    const range = await client.tsRange(key, 0, 9999);

    assert.deepStrictEqual(range, [{ timestamp: 1000, value: 42 }]);
  });

  it('reads RESP3 WITHSCORES from ZDIFF / ZINTER / ZUNION', async () => {
    const a = keyspace.key('setops', 'a');
    const b = keyspace.key('setops', 'b');

    await client.zadd(a, 1, 'x');
    await client.zadd(a, 2, 'y');
    await client.zadd(b, 5, 'x');

    assert.deepStrictEqual(await client.zdiff([a, b], true), [
      { member: 'y', score: 2 },
    ]);

    assert.deepStrictEqual(await client.zinter([a, b], { withScores: true }), [
      { member: 'x', score: 6 },
    ]);

    assert.deepStrictEqual(await client.zunion([a, b], { withScores: true }), [
      { member: 'y', score: 2 },
      { member: 'x', score: 6 },
    ]);
  });

  it('reads RESP3 WITHSCORES from ZRANGEBYSCORE and ZRANDMEMBER', async () => {
    const key = keyspace.key('zrange-by-score');

    await client.zadd(key, 1, 'a');
    await client.zadd(key, 2, 'b');

    assert.deepStrictEqual(
      await client.zrangebyscore(key, 0, 10, {
        withScores: true,
        limit: { offset: 0, count: -1 },
      }),
      [
        { member: 'a', score: 1 },
        { member: 'b', score: 2 },
      ],
    );

    const single = keyspace.key('zrandmember');
    await client.zadd(single, 7, 'only');

    assert.deepStrictEqual(await client.zrandmember(single, 1, true), [
      { member: 'only', score: 7 },
    ]);
  });

  it('reads RESP3 nested pairs from ZSCAN', async () => {
    const key = keyspace.key('zscan');

    await client.zadd(key, 1, 'a');
    await client.zadd(key, 2, 'b');

    const collected: { member: string; score: number }[] = [];

    for await (const batch of client.zscan(key)) {
      collected.push(...batch);
    }

    assert.deepStrictEqual(
      collected.sort((left, right) => left.score - right.score),
      [
        { member: 'a', score: 1 },
        { member: 'b', score: 2 },
      ],
    );
  });

  it('reads a RESP3 double score from BZPOPMIN', async () => {
    const key = keyspace.key('bzpopmin');

    await client.zadd(key, 3, 'first');

    const popped = await client.bzpopmin([key], 1);

    assert.deepStrictEqual(popped, [key, 'first', '3']);
  });

  it('reads RESP3 nested field/value pairs from HRANDFIELD WITHVALUES', async () => {
    const key = keyspace.key('hrandfield');

    await client.hset(key, 'field', 'value');

    assert.deepStrictEqual(await client.hrandfield(key, 1, true), {
      field: 'value',
    });
  });

  it('reads a RESP3 map from CLIENT TRACKINGINFO', async () => {
    const info = await client.clientTrackinginfo();

    assert.ok(Array.isArray(info.flags));
    assert.ok(info.flags.length > 0);
    assert.strictEqual(typeof info.redirect, 'number');
    assert.ok(Array.isArray(info.prefixes));
  });

  it('reads RESP3 consumer maps from XINFO CONSUMERS', async () => {
    const key = keyspace.key('xinfo-consumers');

    await client.xadd(key, '1-1', { f: 'v' });
    await client.xgroupCreate(key, 'grp', '0');
    await client.xreadgroup('grp', 'consumer-a', [key], ['>']);

    const consumers = await client.xinfoConsumers(key, 'grp');

    assert.strictEqual(consumers.length, 1);
    assert.strictEqual(consumers[0].name, 'consumer-a');
    assert.strictEqual(consumers[0].pending, 1);
  });

  it('reads RESP3 stream maps from XREAD and XREADGROUP', async () => {
    const key = keyspace.key('xread');

    await client.xadd(key, '1-1', { f: 'v' });

    const read = await client.xread([key], ['0']);

    assert.ok(read !== null);
    assert.strictEqual(read[0].stream, key);
    assert.deepStrictEqual(read[0].entries, [
      { id: '1-1', fields: { f: 'v' } },
    ]);

    await client.xgroupCreate(key, 'grp', '0');

    const grouped = await client.xreadgroup('grp', 'consumer', [key], ['>']);

    assert.ok(grouped !== null);
    assert.strictEqual(grouped[0].stream, key);
    assert.deepStrictEqual(grouped[0].entries, [
      { id: '1-1', fields: { f: 'v' } },
    ]);
  });

  it('reads a RESP3 map from LCS ... IDX', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key1 = keyspace.key('lcs', '1');
    const key2 = keyspace.key('lcs', '2');

    await client.set(key1, 'ohmytext');
    await client.set(key2, 'mynewtext');

    const result = await client.lcs(key1, key2, {
      idx: true,
      withmatchlen: true,
    });

    assert.strictEqual(typeof result, 'object');

    if (typeof result === 'object') {
      assert.strictEqual(result.length, 6);
      assert.ok(result.matches.length > 0);
      assert.deepStrictEqual(result.matches[0], {
        a: [4, 7],
        b: [5, 8],
        length: 4,
      });
    }
  });

  it('reads RESP3 numeric distance and coordinates from GEOSEARCH', async () => {
    const key = keyspace.key('geosearch');

    await client.geoadd(key, [
      { longitude: 13.361389, latitude: 38.115556, member: 'Palermo' },
    ]);

    const results = await client.geosearch(
      key,
      { fromlonlat: { longitude: 15, latitude: 37 } },
      { byradius: { radius: 400, unit: 'KM' } },
      { withCoord: true, withDist: true },
    );

    assert.strictEqual(results.length, 1);

    const [entry] = results;

    assert.strictEqual(entry.member, 'Palermo');
    /** RESP3 returns the distance as a native double, not a bulk string. */
    assert.strictEqual(typeof entry.distance, 'number');
    assert.ok(entry.distance !== undefined && entry.distance > 0);
    assert.ok(entry.position !== undefined);
    assert.ok(Math.abs((entry.position?.longitude ?? 0) - 13.361389) < 0.001);
  });

  it('reads a RESP3 map from FUNCTION STATS', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const stats = await client.functionStats();

    assert.strictEqual(stats.runningScript, null);
    assert.ok(Array.isArray(stats.engines));
    assert.ok(stats.engines.length > 0);
    assert.strictEqual(typeof stats.engines[0].name, 'string');
    assert.strictEqual(typeof stats.engines[0].libraries, 'number');
    assert.strictEqual(typeof stats.engines[0].functions, 'number');
  });

  it('reads a RESP3 map from COMMAND DOCS', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const docs = await client.commandDocs(['SET']);

    assert.strictEqual(typeof docs, 'object');
    assert.ok('set' in docs);
    assert.strictEqual(typeof docs.set.summary, 'string');
    assert.strictEqual(typeof docs.set.since, 'string');
    assert.strictEqual(typeof docs.set.group, 'string');
  });

  it('reads a RESP3 nested reply from COMMAND GETKEYSANDFLAGS', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const result = await client.commandGetkeysandflags('SET', ['k', 'v']);

    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].key, 'k');
    assert.ok(Array.isArray(result[0].flags));
  });

  it('reads a RESP3 nested reply from SLOWLOG GET', async () => {
    const entries = await client.slowlogGet(5);

    assert.ok(Array.isArray(entries));

    for (const entry of entries) {
      assert.strictEqual(typeof entry.id, 'number');
      assert.strictEqual(typeof entry.timestamp, 'number');
      assert.strictEqual(typeof entry.duration, 'number');
      assert.ok(Array.isArray(entry.commandArguments));
    }
  });

  it('reads a RESP3 map from ACL GETUSER', async () => {
    const info = await client.aclGetuser('default');

    assert.ok(info !== null);
    assert.ok(Array.isArray(info.flags));
    assert.ok(Array.isArray(info.passwords));
    assert.strictEqual(typeof info.commands, 'string');
    assert.strictEqual(typeof info.keys, 'string');
    assert.strictEqual(typeof info.channels, 'string');
    assert.ok(Array.isArray(info.selectors));
  });

  it('reads a RESP3 map from ACL LOG', async () => {
    const entries = await client.aclLog(5);

    assert.ok(Array.isArray(entries));
  });

  it('reads a RESP3 map from FUNCTION LIST', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const list = await client.functionList();

    assert.ok(Array.isArray(list));
  });

  it('reads a RESP3 full stream introspection from XINFO STREAM FULL', async () => {
    const key = keyspace.key('xinfo-full');

    await client.xadd(key, '1-1', { field: 'value' });
    await client.xgroupCreate(key, 'grp', '0');
    await client.xreadgroup('grp', 'consumer-a', [key], ['>']);

    const info = await client.xinfoStream(key, true);

    assert.strictEqual(info.length, 1);
    assert.ok('entries' in info);
    assert.ok(Array.isArray(info.entries));
    assert.ok(Array.isArray(info.groups));
    assert.strictEqual(info.groups.length, 1);

    const group = info.groups[0];

    assert.strictEqual(group.name, 'grp');
    assert.ok(Array.isArray(group.consumers));
    assert.strictEqual(group.consumers.length, 1);
    assert.strictEqual(group.consumers[0].name, 'consumer-a');
  });

  it('reads a RESP3 summary reply from XPENDING', async () => {
    const key = keyspace.key('xpending-summary');

    await client.xadd(key, '1-1', { f: 'v' });
    await client.xgroupCreate(key, 'grp', '0');
    await client.xreadgroup('grp', 'consumer-a', [key], ['>']);

    const summary = await client.xpending(key, 'grp');

    assert.ok(!Array.isArray(summary));
    assert.strictEqual(typeof summary.pending, 'number');
    assert.ok(summary.pending >= 1);
    assert.ok(Array.isArray(summary.consumers));
  });

  it('reads a RESP3 detail reply from XPENDING with range', async () => {
    const key = keyspace.key('xpending-detail');

    await client.xadd(key, '1-1', { f: 'v' });
    await client.xgroupCreate(key, 'grp', '0');
    await client.xreadgroup('grp', 'consumer-a', [key], ['>']);

    const entries = await client.xpending(key, 'grp', '-', '+', 10);

    assert.ok(Array.isArray(entries));
    assert.ok(entries.length >= 1);
    assert.strictEqual(typeof entries[0].id, 'string');
    assert.strictEqual(typeof entries[0].consumer, 'string');
    assert.strictEqual(typeof entries[0].deliveryTime, 'number');
    assert.strictEqual(typeof entries[0].deliveryCount, 'number');
  });

  it('reads a RESP3 reply from MODULE LIST', async () => {
    const modules = await client.moduleList();

    assert.ok(Array.isArray(modules));

    for (const mod of modules) {
      assert.strictEqual(typeof mod.name, 'string');
      assert.strictEqual(typeof mod.version, 'number');
    }
  });

  it('reads a RESP3 reply from TYPE', async () => {
    const key = keyspace.key('type');

    await client.set(key, 'hello');

    const result = await client.type(key);

    assert.strictEqual(result, 'STRING');
  });

  it('reads a RESP3 reply from GEOHASH', async () => {
    const key = keyspace.key('geohash');

    await client.geoadd(key, [
      { longitude: 13.361389, latitude: 38.115556, member: 'Palermo' },
    ]);

    const hashes = await client.geohash(key, ['Palermo', 'absent']);

    assert.strictEqual(hashes.length, 2);
    assert.strictEqual(typeof hashes[0], 'string');
    assert.ok(hashes[0] !== null && hashes[0].length > 0);
    assert.strictEqual(hashes[1], null);
  });

  it('reads a RESP3 reply from TIME', async () => {
    const [seconds, microseconds] = await client.time();

    assert.strictEqual(typeof seconds, 'number');
    assert.strictEqual(typeof microseconds, 'number');
    assert.ok(seconds > 0);
  });

  it('reads a RESP3 reply from XREVRANGE', async () => {
    const key = keyspace.key('xrevrange');

    await client.xadd(key, '1-1', { a: '1' });
    await client.xadd(key, '2-1', { b: '2' });

    const entries = await client.xrevrange(key, '+', '-');

    assert.strictEqual(entries.length, 2);
    assert.strictEqual(entries[0].id, '2-1');
    assert.deepStrictEqual(entries[0].fields, { b: '2' });
    assert.strictEqual(entries[1].id, '1-1');
    assert.deepStrictEqual(entries[1].fields, { a: '1' });
  });

  it('reads a RESP3 reply from XAUTOCLAIM', async () => {
    const key = keyspace.key('xautoclaim');

    await client.xadd(key, '1-1', { f: 'v' });
    await client.xgroupCreate(key, 'grp', '0');
    await client.xreadgroup('grp', 'old-consumer', [key], ['>']);

    await delay(50);

    const result = await client.xautoclaim(key, 'grp', 'new-consumer', 0, '0');

    assert.strictEqual(typeof result.nextId, 'string');
    assert.ok(Array.isArray(result.entries));
    assert.ok(result.entries.length >= 1);
    assert.strictEqual(result.entries[0].id, '1-1');
    assert.deepStrictEqual(result.entries[0].fields, { f: 'v' });
  });

  it('reads a RESP3 reply from XCLAIM', async () => {
    const key = keyspace.key('xclaim');

    await client.xadd(key, '1-1', { f: 'v' });
    await client.xgroupCreate(key, 'grp', '0');
    await client.xreadgroup('grp', 'old-consumer', [key], ['>']);

    const claimed = await client.xclaim(key, 'grp', 'new-consumer', 0, ['1-1']);

    assert.ok(Array.isArray(claimed));
    assert.ok(claimed.length >= 1);

    const entry = claimed[0];

    assert.ok(typeof entry === 'object' && 'id' in entry);
    assert.strictEqual(entry.id, '1-1');
    assert.deepStrictEqual(entry.fields, { f: 'v' });
  });

  it('reads a RESP3 reply from ROLE', async () => {
    const result = await client.role();

    assert.strictEqual(typeof result.role, 'string');
    assert.ok(result.role === 'master' || result.role === 'slave');

    if (result.role === 'master') {
      assert.strictEqual(typeof result.replicationOffset, 'number');
      assert.ok(Array.isArray(result.slaves));
    }
  });

  it('reads a RESP3 reply from BLMPOP', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('blmpop');

    await client.lpush(key, 'a', 'b');

    const result = await client.blmpop(0.1, [key], 'LEFT', 1);

    assert.ok(result !== null);
    assert.strictEqual(result.key, key);
    assert.ok(Array.isArray(result.elements));
    assert.ok(result.elements.length >= 1);
  });

  it('reads a RESP3 reply from BZMPOP', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('bzmpop');

    await client.zadd(key, 1, 'a');

    const result = await client.bzmpop(0.1, [key], 'MIN', 1);

    assert.ok(result !== null);
    assert.strictEqual(result.key, key);
    assert.deepStrictEqual(result.elements, [{ member: 'a', score: 1 }]);
  });

  it('reads a RESP3 double score from BZPOPMAX', async () => {
    const key = keyspace.key('bzpopmax');

    await client.zadd(key, 5, 'last');

    const popped = await client.bzpopmax([key], 1);

    assert.deepStrictEqual(popped, [key, 'last', '5']);
  });

  it('reads a RESP3 reply from LMPOP', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('lmpop');

    await client.lpush(key, 'x', 'y');

    const result = await client.lmpop([key], 'LEFT', 1);

    assert.ok(result !== null);
    assert.strictEqual(result.key, key);
    assert.ok(Array.isArray(result.elements));
    assert.ok(result.elements.length >= 1);
  });

  it('reads RESP3 parsed entries from LATENCY LATEST with real data', async () => {
    await client.configSet('latency-monitor-threshold', '1');

    await client.send([['DEBUG', 'SLEEP', '0.005']]).catch(() => {});
    await client.ping();

    const entries = await client.latencyLatest();

    await client.configSet('latency-monitor-threshold', '0');

    assert.ok(Array.isArray(entries));

    if (entries.length > 0) {
      assert.strictEqual(typeof entries[0].event, 'string');
      assert.strictEqual(typeof entries[0].timestamp, 'number');
      assert.ok(entries[0].timestamp > 0);
      assert.strictEqual(typeof entries[0].latency, 'number');
      assert.strictEqual(typeof entries[0].maximumLatency, 'number');
    }
  });

  it('reads RESP3 parsed entries from LATENCY HISTORY with real data', async () => {
    await client.configSet('latency-monitor-threshold', '1');

    await client.send([['DEBUG', 'SLEEP', '0.005']]).catch(() => {});
    await client.ping();

    const history = await client.latencyHistory('command');

    await client.configSet('latency-monitor-threshold', '0');

    assert.ok(Array.isArray(history));

    if (history.length > 0) {
      assert.strictEqual(typeof history[0].timestamp, 'number');
      assert.ok(history[0].timestamp > 0);
      assert.strictEqual(typeof history[0].latency, 'number');
    }
  });

  it('reads a RESP3 Map reply from LATENCY HISTOGRAM', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('LATENCY HISTOGRAM requires Redis 7.0+');
      return;
    }

    for (let index = 0; index < 10; index += 1) {
      await client.ping();
    }

    const histograms = await client.latencyHistogram('ping');

    assert.strictEqual(typeof histograms, 'object');
    assert.ok('ping' in histograms);
    assert.strictEqual(typeof histograms.ping.calls, 'number');
    assert.ok(histograms.ping.calls >= 10);
    assert.strictEqual(typeof histograms.ping.histogramUsec, 'object');

    const buckets = Object.keys(histograms.ping.histogramUsec);

    assert.ok(buckets.length > 0);

    for (const bucket of buckets) {
      assert.strictEqual(typeof Number(bucket), 'number');
      assert.ok(!Number.isNaN(Number(bucket)));
      assert.strictEqual(
        typeof histograms.ping.histogramUsec[Number(bucket)],
        'number',
      );
    }
  });

  it('reads a RESP3 map from HELLO', async () => {
    const info = await client.hello('RESP3');

    assert.strictEqual(typeof info.server, 'string');
    assert.strictEqual(typeof info.version, 'string');
    assert.strictEqual(info.proto, 3);
    assert.strictEqual(typeof info.id, 'number');
    assert.strictEqual(typeof info.mode, 'string');
    assert.strictEqual(typeof info.role, 'string');
    assert.ok(Array.isArray(info.modules));
  });

  it('reads a RESP3 HELLO reply with SETNAME option', async () => {
    const info = await client.hello(
      'RESP3',
      undefined,
      undefined,
      'resp3-test-client',
    );

    assert.strictEqual(info.proto, 3);
    assert.strictEqual(typeof info.server, 'string');

    const name = await client.clientGetname();

    assert.strictEqual(name, 'resp3-test-client');
  });

  it('reads RESP3 TimeSeries TS.GET / TS.REVRANGE when the module is present', async (context) => {
    if (!hasTimeSeries) {
      context.skip('RedisTimeSeries not loaded');
      return;
    }

    const key = keyspace.key('ts-get');

    await client.tsCreate(key, { labels: { kind: 'resp3-get' } });
    await client.tsAdd(key, 1000, 10);
    await client.tsAdd(key, 2000, 20);

    const sample = await client.tsGet(key);

    assert.ok(sample !== null);
    assert.strictEqual(sample[0], 2000);
    assert.strictEqual(sample[1], 20);

    const range = await client.tsRevrange(key, 0, 9999);

    assert.strictEqual(range.length, 2);
    assert.strictEqual(range[0].timestamp, 2000);
    assert.strictEqual(range[0].value, 20);
    assert.strictEqual(range[1].timestamp, 1000);
    assert.strictEqual(range[1].value, 10);
  });

  it('reads RESP3 TimeSeries TS.MGET / TS.MRANGE / TS.MREVRANGE when the module is present', async (context) => {
    if (!hasTimeSeries) {
      context.skip('RedisTimeSeries not loaded');
      return;
    }

    const key = keyspace.key('ts-multi');
    const label = keyspace.key('ts-multi-label');

    await client.tsCreate(key, { labels: { kind: label } });
    await client.tsAdd(key, 1000, 42);
    await client.tsAdd(key, 2000, 84);

    const mget = await client.tsMget({ kind: label });

    assert.ok(mget.length >= 1);
    assert.strictEqual(mget[0].key, key);
    assert.strictEqual(typeof mget[0].timestamp, 'number');
    assert.strictEqual(typeof mget[0].value, 'number');

    const mrange = await client.tsMrange(0, 9999, { kind: label });

    assert.ok(mrange.length >= 1);
    assert.strictEqual(mrange[0].key, key);
    assert.ok(mrange[0].samples.length >= 2);

    const mrevrange = await client.tsMrevrange(0, 9999, { kind: label });

    assert.ok(mrevrange.length >= 1);
    assert.strictEqual(mrevrange[0].key, key);
    assert.ok(mrevrange[0].samples.length >= 2);
    assert.ok(
      mrevrange[0].samples[0].timestamp >= mrevrange[0].samples[1].timestamp,
    );
  });

  it('reads a RESP3 map from BF.INFO when the module is present', async (context) => {
    if (!hasBloom) {
      context.skip('RedisBloom not loaded');
      return;
    }

    const key = keyspace.key('bf-info');

    await client.bfAdd(key, 'hello');

    const info = await client.bfInfo(key);

    assert.strictEqual(typeof info.capacity, 'number');
    assert.strictEqual(typeof info.size, 'number');
    assert.strictEqual(typeof info.numberOfFilters, 'number');
    assert.strictEqual(typeof info.numberOfItemsInserted, 'number');
    assert.strictEqual(typeof info.expansionRate, 'number');
  });

  it('reads RESP3 JSON.TYPE scalar and array replies when the module is present', async (context) => {
    if (!hasJson) {
      context.skip('RedisJSON not loaded');
      return;
    }

    const key = keyspace.key('json-type');

    await client.jsonSet(
      key,
      '$',
      JSON.stringify({ a: 1, b: 'hello', c: [1, 2] }),
    );

    const rootType = await client.jsonType(key);

    assert.strictEqual(rootType, 'object');

    const pathType = await client.jsonType(key, '$.a');

    assert.ok(Array.isArray(pathType));
    assert.strictEqual(pathType.length, 1);
    assert.strictEqual(pathType[0], 'integer');

    const stringType = await client.jsonType(key, '$.b');

    assert.ok(Array.isArray(stringType));
    assert.strictEqual(stringType[0], 'string');

    const arrayType = await client.jsonType(key, '$.c');

    assert.ok(Array.isArray(arrayType));
    assert.strictEqual(arrayType[0], 'array');

    const missingType = await client.jsonType(key, '$.nonexistent');

    assert.ok(Array.isArray(missingType));
    assert.strictEqual(missingType.length, 0);
  });

  it('reads RESP3 JSON.OBJKEYS reply when the module is present', async (context) => {
    if (!hasJson) {
      context.skip('RedisJSON not loaded');
      return;
    }

    const key = keyspace.key('json-objkeys');

    await client.jsonSet(key, '$', JSON.stringify({ x: 1, y: 2 }));

    const keys = await client.jsonObjkeys(key);

    assert.ok(Array.isArray(keys));
    assert.deepStrictEqual([...keys].sort(), ['x', 'y']);
  });

  it('reads RESP3 JSON.ARRPOP reply when the module is present', async (context) => {
    if (!hasJson) {
      context.skip('RedisJSON not loaded');
      return;
    }

    const key = keyspace.key('json-arrpop');

    await client.jsonSet(key, '$', JSON.stringify([1, 2, 3]));

    const popped = await client.jsonArrpop(key);

    assert.strictEqual(popped, '3');
  });

  it('reads RESP3 SORT_RO with all option combinations', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('sort-ro-opts');

    await client.rpush(key, 'cherry', 'apple', 'banana', 'date', 'elderberry');

    const descAlpha = await client.sortRo(key, { order: 'DESC', alpha: true });

    assert.deepStrictEqual(descAlpha, [
      'elderberry',
      'date',
      'cherry',
      'banana',
      'apple',
    ]);

    const limited = await client.sortRo(key, {
      alpha: true,
      limit: { offset: 1, count: 2 },
    });

    assert.deepStrictEqual(limited, ['banana', 'cherry']);

    const numKey = keyspace.key('sort-ro-num');

    await client.rpush(numKey, '30', '10', '20', '50', '40');

    const ascDefault = await client.sortRo(numKey);

    assert.deepStrictEqual(ascDefault, ['10', '20', '30', '40', '50']);

    const descLimited = await client.sortRo(numKey, {
      order: 'DESC',
      limit: { offset: 0, count: 3 },
    });

    assert.deepStrictEqual(descLimited, ['50', '40', '30']);
  });

  it('reads RESP3 SORT_RO with BY and GET patterns', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('sort-ro-by');

    await client.rpush(key, 'item:1', 'item:2', 'item:3');

    const weightKey1 = `${keyspace.key('sort-ro-by')}:weight:item:1`;
    const weightKey2 = `${keyspace.key('sort-ro-by')}:weight:item:2`;
    const weightKey3 = `${keyspace.key('sort-ro-by')}:weight:item:3`;

    await client.set(weightKey1, '30');
    await client.set(weightKey2, '10');
    await client.set(weightKey3, '20');

    const byPattern = `${keyspace.key('sort-ro-by')}:weight:*`;

    const sorted = await client.sortRo(key, {
      by: byPattern,
      alpha: true,
    });

    assert.deepStrictEqual(sorted, ['item:2', 'item:3', 'item:1']);

    const dataKey1 = `${keyspace.key('sort-ro-by')}:data:item:1`;
    const dataKey2 = `${keyspace.key('sort-ro-by')}:data:item:2`;
    const dataKey3 = `${keyspace.key('sort-ro-by')}:data:item:3`;

    await client.set(dataKey1, 'A');
    await client.set(dataKey2, 'B');
    await client.set(dataKey3, 'C');

    const getPattern = `${keyspace.key('sort-ro-by')}:data:*`;

    const sortedWithGet = await client.sortRo(key, {
      by: byPattern,
      get: [getPattern],
      alpha: true,
    });

    assert.deepStrictEqual(sortedWithGet, ['B', 'C', 'A']);
  });

  it('reads RESP3 FUNCTION LIST with withCode option', async (context) => {
    if (!capabilities.atLeast(7, 0)) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const libraryName = 'solidisresp3test';
    const code = `#!lua name=${libraryName}\nredis.register_function('solidisresp3fn', function() return 'ok' end)`;

    try {
      await client.functionLoad(code, true);
    } catch {
      await client.functionLoad(code);
    }

    const list = await client.functionList({ withCode: true });

    const library = list.find((lib) => lib.libraryName === libraryName);

    assert.ok(library !== undefined);
    assert.strictEqual(library.engine, 'LUA');
    assert.ok(library.code !== undefined);
    assert.ok(library.code.length > 0);
    assert.ok(library.functions.length > 0);
    assert.strictEqual(library.functions[0].name, 'solidisresp3fn');
    assert.ok(Array.isArray(library.functions[0].flags));

    const filtered = await client.functionList({
      libraryNamePattern: libraryName,
    });

    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].libraryName, libraryName);

    await client.functionDelete(libraryName);
  });

  it('reads RESP3 SET with returnOldValue options', async () => {
    const key = keyspace.key('set-get');

    await client.set(key, 'original');

    const old = await client.set(key, 'updated', { returnOldValue: true });

    assert.strictEqual(old, 'original');
    assert.strictEqual(await client.get(key), 'updated');

    const oldBuf = await client.set(key, 'final', {
      returnOldValue: true,
      returnOldValueAsBuffer: true,
    });

    assert.ok(oldBuf instanceof Buffer);
    assert.strictEqual(oldBuf.toString(), 'updated');

    const missingOld = await client.set(
      keyspace.key('set-get-missing'),
      'first',
      {
        returnOldValue: true,
      },
    );

    assert.strictEqual(missingOld, null);
  });
});

/** Geospatial commands: GEOADD, GEOPOS, GEODIST, GEOHASH, GEOSEARCH. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  assertCloseTo,
  closeClient,
  createClient,
  createKeyspace,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

const palermo = {
  longitude: 13.361389,
  latitude: 38.115556,
  member: 'Palermo',
};
const catania = {
  longitude: 15.087269,
  latitude: 37.502669,
  member: 'Catania',
};

describe('geo', () => {
  let client: FeaturedClient;
  const keyspace = createKeyspace('geo');

  const seed = async (key: string): Promise<void> => {
    await client.geoadd(key, [palermo, catania]);
  };

  before(async () => {
    client = await createClient();
  });

  after(async () => {
    await closeClient(client);
  });

  it('adds members with NX option (only add new)', async () => {
    const key = keyspace.key('geoadd-nx');

    assert.strictEqual(await client.geoadd(key, [palermo, catania]), 2);

    const updated = {
      longitude: 14.0,
      latitude: 38.0,
      member: 'Palermo',
    };

    assert.strictEqual(await client.geoadd(key, [updated], { nx: true }), 0);
  });

  it('adds members with XX option (only update existing)', async () => {
    const key = keyspace.key('geoadd-xx');

    await client.geoadd(key, [palermo]);

    const newMember = {
      longitude: 12.0,
      latitude: 41.0,
      member: 'Rome',
    };

    assert.strictEqual(await client.geoadd(key, [newMember], { xx: true }), 0);
  });

  it('adds members with CH option (return changed count)', async () => {
    const key = keyspace.key('geoadd-ch');

    await client.geoadd(key, [palermo]);

    const updated = {
      longitude: 14.0,
      latitude: 38.0,
      member: 'Palermo',
    };

    const changed = await client.geoadd(key, [updated], { ch: true });

    /** Palermo's coordinates moved, so CH reports exactly one change. */
    assert.strictEqual(changed, 1);
  });

  it('adds members and reports positions', async () => {
    const key = keyspace.key('positions');

    assert.strictEqual(await client.geoadd(key, [palermo, catania]), 2);

    const positions = await client.geopos(key, ['Palermo', 'Missing']);

    assert.strictEqual(positions.length, 2);
    assertCloseTo(positions[0]?.longitude ?? 0, palermo.longitude, 3);
    assertCloseTo(positions[0]?.latitude ?? 0, palermo.latitude, 3);
    assert.strictEqual(positions[1], null);
  });

  it('measures distance between members', async () => {
    const key = keyspace.key('distance');

    await seed(key);

    const meters = await client.geodist(key, 'Palermo', 'Catania');

    assert.ok(meters !== null && meters > 160000);
    assert.ok(meters !== null && meters < 170000);

    const kilometers = await client.geodist(key, 'Palermo', 'Catania', 'KM');

    assert.ok(kilometers !== null && kilometers > 160);
    assert.ok(kilometers !== null && kilometers < 170);

    assert.strictEqual(await client.geodist(key, 'Palermo', 'Missing'), null);
  });

  it('returns geohash strings', async () => {
    const key = keyspace.key('hash');

    await seed(key);

    const hashes = await client.geohash(key, ['Palermo', 'Catania']);

    assert.strictEqual(hashes.length, 2);
    assert.ok(hashes[0] !== null && /^[0-9a-z]+$/.test(hashes[0]));
  });

  it('searches within a radius', async () => {
    const key = keyspace.key('radius');

    await seed(key);

    const results = await client.geosearch(
      key,
      { fromlonlat: { longitude: 15, latitude: 37 } },
      { byradius: { radius: 200, unit: 'KM' } },
    );

    const members = results.map((entry) => entry.member);

    assert.deepStrictEqual([...members].sort(), ['Catania', 'Palermo']);
  });

  it('searches within a bounding box with projections', async () => {
    const key = keyspace.key('box');

    await seed(key);

    const results = await client.geosearch(
      key,
      { fromlonlat: { longitude: 15, latitude: 37 } },
      { bybox: { width: 400, height: 400, unit: 'KM' } },
      { withCoord: true, withDist: true, asc: true },
    );

    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].member, 'Catania');
    assertCloseTo(results[0].distance ?? 0, 56.4413, 1);
    assertCloseTo(results[0].position?.longitude ?? 0, catania.longitude, 2);
    assertCloseTo(results[0].position?.latitude ?? 0, catania.latitude, 2);
  });

  it('searches from an existing member', async () => {
    const key = keyspace.key('frommember');

    await seed(key);

    const results = await client.geosearch(
      key,
      { frommember: 'Palermo' },
      { byradius: { radius: 200, unit: 'KM' } },
    );

    assert.deepStrictEqual([...results.map((entry) => entry.member)].sort(), [
      'Catania',
      'Palermo',
    ]);
  });

  it('queries with GEORADIUS', async () => {
    const key = keyspace.key('georadius');

    await seed(key);

    const results = await client.georadius(key, 15, 37, 200, 'KM');

    assert.ok(Array.isArray(results));
    const members = results.map((entry) => entry.member);

    assert.deepStrictEqual([...members].sort(), ['Catania', 'Palermo']);
  });

  it('queries with GEORADIUSBYMEMBER', async () => {
    const key = keyspace.key('georadiusbymember');

    await seed(key);

    const results = await client.georadiusbymember(key, 'Palermo', 200, 'KM');

    assert.ok(Array.isArray(results));
    assert.deepStrictEqual([...results.map((entry) => entry.member)].sort(), [
      'Catania',
      'Palermo',
    ]);
  });

  it('stores results with GEOSEARCHSTORE', async () => {
    const source = keyspace.key('geosearchstore-source');
    const destination = keyspace.key('geosearchstore-destination');

    await seed(source);

    const stored = await client.geosearchstore(
      destination,
      source,
      { fromlonlat: { longitude: 15, latitude: 37 } },
      { byradius: { radius: 200, unit: 'KM' } },
    );

    assert.strictEqual(stored, 2);

    const positions = await client.geopos(destination, ['Palermo', 'Catania']);

    assertCloseTo(positions[0]?.longitude ?? 0, palermo.longitude, 3);
    assertCloseTo(positions[0]?.latitude ?? 0, palermo.latitude, 3);
    assertCloseTo(positions[1]?.longitude ?? 0, catania.longitude, 3);
    assertCloseTo(positions[1]?.latitude ?? 0, catania.latitude, 3);
  });

  it('queries read-only with GEORADIUS_RO', async () => {
    const key = keyspace.key('georadius-ro');

    await seed(key);

    const results = await client.georadiusRo(key, 15, 37, 200, 'KM');

    assert.deepStrictEqual(results.map((entry) => entry.member).sort(), [
      'Catania',
      'Palermo',
    ]);
  });

  it('queries read-only by member with GEORADIUSBYMEMBER_RO', async () => {
    const key = keyspace.key('georadiusbymember-ro');

    await seed(key);

    const results = await client.georadiusbymemberRo(key, 'Palermo', 200, 'KM');

    assert.deepStrictEqual(results.map((entry) => entry.member).sort(), [
      'Catania',
      'Palermo',
    ]);
  });

  it('stores GEORADIUS results with STORE option', async () => {
    const key = keyspace.key('georadius-store');
    const destination = keyspace.key('georadius-store-dest');

    await client.geoadd(key, [palermo, catania]);

    const result = await client.georadius(key, 15, 37, 200, 'KM', {
      store: destination,
    });

    /** Both seeded cities fall within 200km of (15, 37). */
    assert.strictEqual(result, 2);
    assert.strictEqual(await client.zcard(destination), 2);
  });

  it('stores GEORADIUSBYMEMBER results with STOREDIST option', async () => {
    const key = keyspace.key('georadiusbymember-store');
    const destination = keyspace.key('georadiusbymember-store-dest');

    await client.geoadd(key, [palermo, catania]);

    const result = await client.georadiusbymember(key, 'Palermo', 200, 'KM', {
      storedist: destination,
    });

    /** Catania is ~166km from Palermo, so both land in the destination set. */
    assert.strictEqual(result, 2);
    assert.strictEqual(await client.zcard(destination), 2);
  });

  it('returns null for missing member in GEOHASH', async () => {
    const key = keyspace.key('geohash-null');

    await client.geoadd(key, [palermo]);

    const hashes = await client.geohash(key, ['Palermo', 'NonExistent']);

    assert.strictEqual(hashes.length, 2);
    assert.strictEqual(typeof hashes[0], 'string');
    assert.strictEqual(hashes[1], null);
  });

  it('returns distance, hash, and coordinates with GEOSEARCH projections', async () => {
    const key = keyspace.key('geosearch-projections');

    await client.geoadd(key, [
      { longitude: 13.361389, latitude: 38.115556, member: 'Palermo' },
      { longitude: 15.087269, latitude: 37.502669, member: 'Catania' },
    ]);

    const results = await client.geosearch(
      key,
      { fromlonlat: { longitude: 15, latitude: 37 } },
      { byradius: { radius: 200, unit: 'KM' } },
      { withCoord: true, withDist: true, withHash: true, asc: true },
    );

    assert.strictEqual(results.length, 2);

    /** asc orders by distance; Catania (~56km) is nearer than Palermo (~166km). */
    const [entry] = results;

    assert.strictEqual(entry.member, 'Catania');
    assertCloseTo(entry.distance ?? 0, 56.4413, 1);
    assertCloseTo(entry.position?.longitude ?? 0, 15.087269, 2);
    assertCloseTo(entry.position?.latitude ?? 0, 37.502669, 2);
  });

  it('builds GEORADIUS with COUNT/ANY/ASC options', async () => {
    const { createCommand } = await import(
      '../../../sources/command/georadius.ts'
    );

    const command = createCommand('key', 15, 37, 200, 'KM', {
      count: 5,
      any: true,
      asc: true,
      withCoord: true,
      withDist: true,
      withHash: true,
    });

    assert.deepStrictEqual(command, [
      'GEORADIUS',
      'key',
      '15',
      '37',
      '200',
      'km',
      'WITHCOORD',
      'WITHDIST',
      'WITHHASH',
      'COUNT',
      '5',
      'ANY',
      'ASC',
    ]);
  });

  it('builds GEORADIUS with DESC and STOREDIST options', async () => {
    const { createCommand } = await import(
      '../../../sources/command/georadius.ts'
    );

    const command = createCommand('key', 15, 37, 200, 'KM', {
      desc: true,
      storedist: 'destination',
    });

    assert.deepStrictEqual(command, [
      'GEORADIUS',
      'key',
      '15',
      '37',
      '200',
      'km',
      'DESC',
      'STOREDIST',
      'destination',
    ]);
  });

  it('builds GEOSEARCH with all projections and COUNT/ANY/DESC', async () => {
    const { buildGeoSearchCommand } = await import(
      '../../../sources/command/utils/command.ts'
    );

    const command = buildGeoSearchCommand(
      ['GEOSEARCH', 'key'],
      { fromlonlat: { longitude: 15, latitude: 37 } },
      { byradius: { radius: 100, unit: 'KM' } },
      {
        withCoord: true,
        withDist: true,
        withHash: true,
        count: 10,
        any: true,
        desc: true,
      },
    );

    assert.deepStrictEqual(command, [
      'GEOSEARCH',
      'key',
      'FROMLONLAT',
      '15',
      '37',
      'BYRADIUS',
      '100',
      'km',
      'WITHCOORD',
      'WITHDIST',
      'WITHHASH',
      'COUNT',
      '10',
      'ANY',
      'DESC',
    ]);
  });

  it('builds GEOSEARCH with ASC and BYBOX options', async () => {
    const { buildGeoSearchCommand } = await import(
      '../../../sources/command/utils/command.ts'
    );

    const command = buildGeoSearchCommand(
      ['GEOSEARCH', 'key'],
      { frommember: 'origin' },
      { bybox: { width: 200, height: 100, unit: 'KM' } },
      { asc: true },
    );

    assert.deepStrictEqual(command, [
      'GEOSEARCH',
      'key',
      'FROMMEMBER',
      'origin',
      'BYBOX',
      '200',
      '100',
      'km',
      'ASC',
    ]);
  });

  it('parses GeoRadius reply with dist/hash/coord projections', async () => {
    const { tryReplyToGeoRadius } = await import(
      '../../../sources/command/utils/reply.ts'
    );

    const result = tryReplyToGeoRadius(
      [['Palermo', '190.44', 3479099956230698, ['13.361389', '38.115556']]],
      'GEOSEARCH',
      { withDist: true, withHash: true, withCoord: true },
    );

    assert.strictEqual(result[0].member, 'Palermo');
    assert.strictEqual(result[0].distance, 190.44);
    assert.strictEqual(result[0].hash, 3479099956230698);
    assertCloseTo(result[0].position?.longitude ?? 0, 13.361389, 3);
    assertCloseTo(result[0].position?.latitude ?? 0, 38.115556, 3);
  });

  it('parses GeoRadius reply as simple member list without options', async () => {
    const { tryReplyToGeoRadius } = await import(
      '../../../sources/command/utils/reply.ts'
    );

    const result = tryReplyToGeoRadius(['Palermo', 'Catania'], 'GEORADIUS');

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].member, 'Palermo');
    assert.strictEqual(result[1].member, 'Catania');
  });
});

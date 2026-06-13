/**
 * Bitmap operations (SETBIT/GETBIT/BITCOUNT/BITPOS/BITOP/BITFIELD) and the
 * probabilistic HyperLogLog cardinality estimator (PFADD/PFCOUNT/PFMERGE).
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
} from '../utils/index.ts';

import type { FeaturedClient } from '../utils/index.ts';

describe('bitmaps-hyperloglog', () => {
  let client: FeaturedClient;
  let atLeast7 = false;
  const keyspace = createKeyspace('bits');

  before(async () => {
    client = await createClient();
    atLeast7 = (await detectServerCapabilities(client)).atLeast(7, 0);
  });

  after(async () => {
    await closeClient(client);
  });

  it('sets and reads individual bits', async () => {
    const key = keyspace.key('setbit');

    assert.strictEqual(await client.setbit(key, 7, 1), 0);
    assert.strictEqual(await client.getbit(key, 7), 1);
    assert.strictEqual(await client.getbit(key, 6), 0);
    assert.strictEqual(await client.setbit(key, 7, 0), 1);
  });

  it('counts set bits with and without ranges', async () => {
    const key = keyspace.key('bitcount');

    await client.set(key, 'foobar');

    assert.strictEqual(await client.bitcount(key), 26);
    assert.strictEqual(await client.bitcount(key, { start: 0, end: 0 }), 4);
    assert.strictEqual(await client.bitcount(key, { start: 1, end: 1 }), 6);
  });

  it('counts set bits over a BIT-indexed range', async (context) => {
    /** The BYTE/BIT range mode for BITCOUNT was introduced in Redis 7.0. */
    if (!atLeast7) {
      context.skip('BITCOUNT BIT mode requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('bitcount-bit');

    await client.set(key, 'foobar');

    assert.strictEqual(
      await client.bitcount(key, { start: 5, end: 30, mode: 'BIT' }),
      17,
    );
  });

  it('finds the first matching bit with BITPOS', async () => {
    const key = keyspace.key('bitpos');

    await client.set(key, Buffer.from([0xff, 0xf0, 0x00]));

    assert.strictEqual(await client.bitpos(key, 0), 12);

    const onesKey = keyspace.key('bitpos', 'ones');

    await client.set(onesKey, Buffer.from([0x00, 0x0f, 0xff]));

    assert.strictEqual(await client.bitpos(onesKey, 1), 12);
  });

  it('finds bit position within a byte range', async () => {
    const key = keyspace.key('bitpos-range');

    await client.set(key, Buffer.from([0xff, 0x00, 0xff]));

    assert.strictEqual(await client.bitpos(key, 0, { start: 1 }), 8);
    assert.strictEqual(await client.bitpos(key, 0, { start: 0, end: 0 }), -1);
    assert.strictEqual(await client.bitpos(key, 1, { start: 1, end: 2 }), 16);
  });

  it('finds bit position with BIT mode', async (context) => {
    if (!atLeast7) {
      context.skip('requires Redis 7.0+');
      return;
    }

    const key = keyspace.key('bitpos-bit-mode');

    await client.set(key, Buffer.from([0xf0]));

    const result = await client.bitpos(key, 0, {
      start: 0,
      end: 7,
      mode: 'BIT',
    });

    assert.strictEqual(result, 4);
  });

  it('combines bitmaps with BITOP', async () => {
    const first = keyspace.key('bitop', 'a');
    const second = keyspace.key('bitop', 'b');
    const destination = keyspace.key('bitop', 'dest');

    await client.set(first, 'abc');
    await client.set(second, 'abd');

    const length = await client.bitop('AND', destination, [first, second]);

    assert.strictEqual(length, 3);

    const notDestination = keyspace.key('bitop', 'not');

    assert.strictEqual(await client.bitop('NOT', notDestination, [first]), 3);

    const { createCommand } = await import('../../../sources/command/bitop.ts');

    assert.throws(
      () => createCommand('NOT', 'dest', ['a', 'b']),
      (error: Error) => error.message.includes('exactly one source key'),
    );
  });

  it('manipulates packed integers with BITFIELD', async () => {
    const key = keyspace.key('bitfield');

    const result = await client.bitfield(key, [
      { operation: 'SET', type: 'u8', offset: 0, value: 255 },
      { operation: 'GET', type: 'u8', offset: 0 },
      { operation: 'INCRBY', type: 'u8', offset: 0, increment: 10 },
    ]);

    assert.deepStrictEqual(result, [0, 255, 9]);
  });

  it('reads packed integers with BITFIELD_RO', async () => {
    const key = keyspace.key('bitfield-ro');

    await client.bitfield(key, [
      { operation: 'SET', type: 'u8', offset: 0, value: 42 },
    ]);

    assert.deepStrictEqual(
      await client.bitfieldRo(key, [{ type: 'u8', offset: 0 }]),
      [42],
    );
  });

  it('honours BITFIELD overflow strategies', async () => {
    const key = keyspace.key('bitfield', 'overflow');

    const result = await client.bitfield(
      key,
      [
        { operation: 'SET', type: 'u8', offset: 0, value: 255 },
        { operation: 'INCRBY', type: 'u8', offset: 0, increment: 10 },
      ],
      'SAT',
    );

    assert.deepStrictEqual(result, [0, 255]);
  });

  it('estimates cardinality with HyperLogLog', async () => {
    const key = keyspace.key('pf');

    assert.strictEqual(await client.pfadd(key, ['a', 'b', 'c', 'd']), 1);
    await client.pfadd(key, ['a', 'b']);

    assert.strictEqual(await client.pfcount([key]), 4);
  });

  it('merges HyperLogLog structures', async () => {
    const first = keyspace.key('pf', 'first');
    const second = keyspace.key('pf', 'second');
    const merged = keyspace.key('pf', 'merged');

    await client.pfadd(first, ['a', 'b', 'c']);
    await client.pfadd(second, ['c', 'd', 'e']);

    assert.strictEqual(await client.pfmerge(merged, [first, second]), 'OK');
    assert.strictEqual(await client.pfcount([merged]), 5);
    assert.strictEqual(await client.pfcount([first, second]), 5);
  });
});

/**
 * Raw pipelining via client.send(): reply ordering, large batches that exceed
 * maxCommandsPerPipeline (forcing internal chunking), binary round-trips, and
 * error isolation within a batch.
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  closeClient,
  createClient,
  createKeyspace,
  range,
} from '../utils/index.ts';

import type { SolidisData } from '../../../sources/index.ts';
import type { FeaturedClient } from '../utils/index.ts';

function unwrap(replies: SolidisData[][], index: number): SolidisData {
  return replies[index]?.[0] ?? null;
}

describe('pipeline', () => {
  let client: FeaturedClient;
  const keyspace = createKeyspace('pipeline');

  before(async () => {
    client = await createClient();
  });

  after(async () => {
    await closeClient(client);
  });

  it('preserves the order of replies', async () => {
    const key = keyspace.key('ordered');

    const replies = await client.send([
      ['SET', key, 'value'],
      ['INCR', keyspace.key('counter')],
      ['APPEND', key, '!'],
      ['GET', key],
    ]);

    assert.strictEqual(unwrap(replies, 0), 'OK');
    assert.strictEqual(unwrap(replies, 1), 1);
    assert.strictEqual(unwrap(replies, 2), 6);
    assert.strictEqual(`${unwrap(replies, 3)}`, 'value!');
  });

  it('processes a batch larger than maxCommandsPerPipeline', async () => {
    const total = 1000;

    const commands = range(total).map((index) => [
      'SET',
      keyspace.key('bulk', index),
      `${index}`,
    ]);

    const replies = await client.send(commands);

    assert.strictEqual(replies.length, total);
    assert.strictEqual(
      replies.every((reply) => reply[0] === 'OK'),
      true,
    );

    const readback = await client.send(
      range(total).map((index) => ['GET', keyspace.key('bulk', index)]),
    );

    assert.strictEqual(`${unwrap(readback, 0)}`, '0');
    assert.strictEqual(`${unwrap(readback, total - 1)}`, `${total - 1}`);
  });

  it('mixes reads and writes in a single round trip', async () => {
    const key = keyspace.key('mixed');

    const replies = await client.send([
      ['DEL', key],
      ['RPUSH', key, 'a', 'b', 'c'],
      ['LLEN', key],
      ['LRANGE', key, '0', '-1'],
      ['LPOP', key],
    ]);

    assert.strictEqual(unwrap(replies, 1), 3);
    assert.strictEqual(unwrap(replies, 2), 3);
    const rangeResult = unwrap(replies, 3);

    assert.ok(Array.isArray(rangeResult));
    assert.deepStrictEqual(
      rangeResult.map((item) => `${item}`),
      ['a', 'b', 'c'],
    );
    assert.strictEqual(`${unwrap(replies, 4)}`, 'a');
  });

  it('round-trips binary payloads through a pipeline', async () => {
    const key = keyspace.key('binary');
    const payload = Buffer.from([0x00, 0x10, 0xff, 0x7f, 0x80]);

    const replies = await client.send([
      ['SET', key, payload],
      ['GET', key],
    ]);

    const value = unwrap(replies, 1);

    assert.ok(Buffer.isBuffer(value));
    assert.strictEqual(value.equals(payload), true);
  });

  it('isolates a command error without rejecting the whole batch by default', async () => {
    const stringKey = keyspace.key('error', 'string');

    const replies = await client.send([
      ['SET', stringKey, 'not-a-list'],
      ['LPUSH', stringKey, 'x'],
      ['GET', stringKey],
    ]);

    assert.strictEqual(unwrap(replies, 0), 'OK');
    assert.ok(unwrap(replies, 1) instanceof Error);
    assert.strictEqual(`${unwrap(replies, 2)}`, 'not-a-list');
  });

  it('throws guard error when pipeline called on invalid context', async () => {
    const { guard } = await import('../../../sources/command/utils/command.ts');

    assert.throws(
      () => guard(null, ['TEST']),
      (error: Error) => error.message.includes('not a valid solidis client'),
    );

    assert.throws(
      () => guard({}, ['TEST']),
      (error: Error) => error.message.includes('Send method'),
    );
  });

  it('queues command when pipeQueue is present (transaction context)', async () => {
    const { guard } = await import('../../../sources/command/utils/command.ts');

    const fakeClient = {
      send: () => Promise.resolve([]),
      pipeQueue: [] as string[][],
    };

    const result = guard(fakeClient, ['SET', 'key', 'value']);

    assert.strictEqual(result, false);
    assert.strictEqual(fakeClient.pipeQueue.length, 1);
    assert.deepStrictEqual(fakeClient.pipeQueue[0], ['SET', 'key', 'value']);
  });
});

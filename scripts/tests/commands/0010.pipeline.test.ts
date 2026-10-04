/** Raw pipelining via client.send(): ordering, chunking, binary round-trips, error isolation. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { RespError } from '../../../sources/index.ts';
import {
  closeClient,
  createClient,
  createKeyspace,
  range,
} from '../utils/index.ts';

import type { SolidisData, StringOrBuffer } from '../../../sources/index.ts';
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
    assert.deepStrictEqual(unwrap(replies, 3), Buffer.from('value!'));
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

    assert.deepStrictEqual(
      readback.map((reply) => reply[0]),
      range(total).map((index) => Buffer.from(`${index}`)),
    );
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

    assert.strictEqual(unwrap(replies, 0), 0);
    assert.strictEqual(unwrap(replies, 1), 3);
    assert.strictEqual(unwrap(replies, 2), 3);
    assert.deepStrictEqual(unwrap(replies, 3), [
      Buffer.from('a'),
      Buffer.from('b'),
      Buffer.from('c'),
    ]);
    assert.deepStrictEqual(unwrap(replies, 4), Buffer.from('a'));
  });

  it('round-trips binary payloads through a pipeline', async () => {
    const key = keyspace.key('binary');
    const payload = Buffer.from([0x00, 0x10, 0xff, 0x7f, 0x80]);

    const replies = await client.send([
      ['SET', key, payload],
      ['GET', key],
    ]);

    assert.strictEqual(unwrap(replies, 0), 'OK');

    const value = unwrap(replies, 1);

    assert.deepStrictEqual(value, payload);
  });

  it('isolates a command error without rejecting the whole batch by default', async () => {
    const stringKey = keyspace.key('error', 'string');

    const replies = await client.send([
      ['SET', stringKey, 'not-a-list'],
      ['LPUSH', stringKey, 'x'],
      ['GET', stringKey],
    ]);

    assert.strictEqual(unwrap(replies, 0), 'OK');

    const pipelineError = unwrap(replies, 1);

    if (!(pipelineError instanceof Error)) {
      assert.fail('LPUSH on a string key must return an Error');
    }

    assert.strictEqual(
      pipelineError.message,
      'WRONGTYPE Operation against a key holding the wrong kind of value',
    );
    assert.deepStrictEqual(unwrap(replies, 2), Buffer.from('not-a-list'));
  });

  it('throws guard error when pipeline called on invalid context', async () => {
    const { guard } = await import('../../../sources/command/utils/command.ts');

    assert.throws(() => guard(null, ['TEST']), {
      message: '[TEST] Send method is not implemented',
    });

    assert.throws(() => guard({}, ['TEST']), {
      message: '[TEST] Send method is not implemented',
    });
    assert.throws(() => guard({ send: 'not a function' }, ['TEST']), {
      message: '[TEST] Send method is not implemented',
    });
  });

  it('queues transaction calls through the send() of a client and puts it back', async () => {
    const { guard } = await import('../../../sources/command/utils/command.ts');
    const { set } = await import('../../../sources/command/set.ts');
    const { multi } = await import('../../../sources/command/multi.ts');
    const sent: StringOrBuffer[][][] = [];
    const send = async (commands: StringOrBuffer[][]) => {
      sent.push(commands);

      return commands.map(([name]) => [name === 'EXEC' ? ['OK'] : 'OK']);
    };
    const fakeClient = { send, set, multi };

    assert.strictEqual(guard(fakeClient, ['GET', 'key']), true);

    const transaction = fakeClient.multi();

    transaction.set('key', 'value');

    assert.strictEqual(fakeClient.send, send);
    assert.deepStrictEqual(sent, []);
    assert.deepStrictEqual(await transaction.exec(), ['OK']);
    assert.deepStrictEqual(sent, [
      [['MULTI'], ['SET', 'key', 'value'], ['EXEC']],
    ]);
  });

  it('returns every reply of a featured pipeline in order', async () => {
    const key = keyspace.key('featured');
    const counter = keyspace.key('featured', 'counter');

    const replies = await client.pipeline([
      ['SET', key, 'value'],
      ['INCR', counter],
      ['INCR', counter],
      ['GET', key],
    ]);

    assert.deepStrictEqual(replies, ['OK', 1, 2, Buffer.from('value')]);
  });

  it('keeps command errors inline in a featured pipeline', async () => {
    const key = keyspace.key('featured', 'error');

    const [status, error, value] = await client.pipeline([
      ['SET', key, 'text'],
      ['INCR', key],
      ['GET', key],
    ]);

    assert.strictEqual(status, 'OK');
    assert.ok(error instanceof RespError);
    assert.strictEqual(error.code, 'ERR');
    assert.deepStrictEqual(value, Buffer.from('text'));
  });

  it('resolves an empty batch without a round trip', async () => {
    assert.deepStrictEqual(await client.send([]), []);
    assert.deepStrictEqual(await client.pipeline([]), []);
  });

  it('rejects a batch containing an empty command before sending any of it', async () => {
    const key = keyspace.key('empty-command');

    await assert.rejects(client.send([['SET', key, 'value'], []]), {
      name: 'SolidisRequesterError',
      message: 'Cannot send an empty or non-array command.',
    });

    assert.strictEqual(await client.get(key), null);
    assert.strictEqual(await client.echo('aligned'), 'aligned');
  });

  for (const command of [
    ['MONITOR'],
    ['sync'],
    ['PSYNC', '?', '-1'],
    ['CLIENT', 'REPLY', 'OFF'],
    ['client', 'reply', 'skip'],
  ]) {
    it(`rejects ${command.join(' ')} because it breaks reply pairing`, async () => {
      const key = keyspace.key('unsupported', command.join('-'));

      await assert.rejects(client.send([['SET', key, 'value'], command]), {
        name: 'SolidisRequesterError',
        message:
          /is not supported: it breaks the pairing of requests and replies\.$/,
      });

      assert.strictEqual(await client.get(key), null);
      assert.strictEqual(await client.echo('aligned'), 'aligned');
    });
  }

  it('allows CLIENT REPLY ON because every command still gets a reply', async () => {
    const replies = await client.send([
      ['CLIENT', 'REPLY', 'ON'],
      ['ECHO', 'after'],
    ]);

    assert.deepStrictEqual(replies, [['OK'], [Buffer.from('after')]]);
  });
});

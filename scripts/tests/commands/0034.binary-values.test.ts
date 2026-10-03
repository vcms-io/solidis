/** Values written as bytes come back as the same bytes when a read asks for a Buffer. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { tryReplyToStringOrBuffer } from '../../../sources/command/utils/reply.ts';
import { SolidisProtocols } from '../../../sources/index.ts';
import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
  range,
} from '../utils/index.ts';

import type {
  CommandBufferOptions,
  RespLmpop,
} from '../../../sources/index.ts';
import type { FeaturedClient } from '../utils/index.ts';

type IsEqual<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

const binary = Buffer.from([0x00, 0xff, 0xfe, 0x80, 0x0d, 0x0a, 0xc3, 0x28]);
const split = Buffer.from('가나', 'utf8');
const second = Buffer.from([0x01, 0x02, 0xc0, 0xaf]);
const buffer = { buffer: true } as const;

describe('binary-values', () => {
  const keyspace = createKeyspace('binary-values');

  it('converts replies to Buffers only on request', () => {
    const command = ['GET', 'key'];

    assert.strictEqual(
      tryReplyToStringOrBuffer(binary, command, buffer),
      binary,
    );
    assert.deepStrictEqual(
      tryReplyToStringOrBuffer('OK', command, buffer),
      Buffer.from('OK'),
    );
    assert.strictEqual(
      tryReplyToStringOrBuffer(split, command, undefined),
      '가나',
    );
    assert.strictEqual(
      tryReplyToStringOrBuffer(split, command, { buffer: false }),
      '가나',
    );
    assert.throws(() => tryReplyToStringOrBuffer(1, command, buffer), {
      message: '[GET] Unexpected reply: number',
    });
    assert.throws(() => tryReplyToStringOrBuffer(null, command, buffer), {
      message: '[GET] Unexpected reply: null',
    });
  });

  for (const protocol of [SolidisProtocols.RESP2, SolidisProtocols.RESP3]) {
    describe(`over ${protocol}`, () => {
      let client: FeaturedClient;
      let isAtLeast7 = false;
      let isAtLeast62 = false;

      before(async () => {
        client = await createClient({ protocol });

        const capabilities = await detectServerCapabilities(client);

        isAtLeast7 = capabilities.atLeast(7, 0);
        isAtLeast62 = capabilities.atLeast(6, 2);
      });

      after(async () => {
        await closeClient(client);
      });

      it('reads string values as bytes', async () => {
        const key = keyspace.key(protocol, 'string');
        const other = keyspace.key(protocol, 'string-other');
        const missing = keyspace.key(protocol, 'string-missing');

        await client.set(key, binary);
        await client.msetnx({ [other]: second });

        const value = await client.get(key, buffer);
        const text = await client.get(key);
        const isBuffer: IsEqual<typeof value, Buffer | null> = true;
        const isText: IsEqual<typeof text, string | null> = true;

        assert.strictEqual(isBuffer, true);
        assert.strictEqual(isText, true);
        assert.deepStrictEqual(value, binary);
        assert.notDeepStrictEqual(Buffer.from(text ?? ''), binary);

        const values = await client.mget(key, missing, other, buffer);
        const isBufferList: IsEqual<typeof values, (Buffer | null)[]> = true;

        assert.strictEqual(isBufferList, true);
        assert.deepStrictEqual(values, [binary, null, second]);
        assert.deepStrictEqual(await client.mget(key, missing), [text, null]);

        const head = await client.getrange(key, 0, 3, buffer);
        const isRange: IsEqual<typeof head, Buffer> = true;

        assert.strictEqual(isRange, true);
        assert.deepStrictEqual(head, binary.subarray(0, 4));

        await client.set(key, split);

        assert.deepStrictEqual(
          await client.getrange(key, 0, 1, buffer),
          split.subarray(0, 2),
        );
        assert.strictEqual(await client.getrange(key, 0, 1), '�');

        assert.strictEqual(await client.append(key, binary), split.length + 8);
        assert.deepStrictEqual(
          await client.get(key, buffer),
          Buffer.concat([split, binary]),
        );
        assert.deepStrictEqual(
          await client.set(key, second, {
            returnOldValue: true,
            returnOldValueAsBuffer: true,
          }),
          Buffer.concat([split, binary]),
        );
        assert.deepStrictEqual(await client.getdel(key, buffer), second);
        assert.strictEqual(await client.getdel(key, buffer), null);
        assert.strictEqual(await client.get(missing, buffer), null);
      });

      it('reads GETEX values as bytes together with an expiration', async (context) => {
        if (!isAtLeast62) {
          context.skip('requires Redis 6.2+ with GETEX');
          return;
        }

        const key = keyspace.key(protocol, 'getex');

        await client.set(key, binary);

        const value = await client.getex(key, {
          expireInSeconds: 100,
          buffer: true,
        });
        const isBuffer: IsEqual<typeof value, Buffer | null> = true;

        assert.strictEqual(isBuffer, true);
        assert.deepStrictEqual(value, binary);
        assert.ok((await client.ttl(key)) > 0);
        assert.deepStrictEqual(
          await client.getex(key, { persist: true, buffer: true }),
          binary,
        );
        assert.strictEqual(await client.ttl(key), -1);
        assert.strictEqual(typeof (await client.getex(key)), 'string');
      });

      it('reads hash values as bytes', async () => {
        const key = keyspace.key(protocol, 'hash');

        await client.hset(key, 'binary', binary);
        await client.hset(key, 'second', second);

        const value = await client.hget(key, 'binary', buffer);
        const isBuffer: IsEqual<typeof value, Buffer | null> = true;

        assert.strictEqual(isBuffer, true);
        assert.deepStrictEqual(value, binary);
        assert.deepStrictEqual(
          await client.hmget(key, 'second', 'missing', 'binary', buffer),
          [second, null, binary],
        );

        const all = await client.hgetall(key, buffer);
        const isRecord: IsEqual<typeof all, Record<string, Buffer>> = true;

        assert.strictEqual(isRecord, true);
        assert.deepStrictEqual(all, { binary, second });

        const values = await client.hvals(key, buffer);

        assert.deepStrictEqual(
          values.toSorted(Buffer.compare),
          [binary, second].toSorted(Buffer.compare),
        );
        assert.strictEqual(typeof (await client.hget(key, 'binary')), 'string');
      });

      it('writes and reads list elements as bytes', async () => {
        const key = keyspace.key(protocol, 'list');
        const target = keyspace.key(protocol, 'list-target');

        assert.strictEqual(await client.rpush(key, binary, second), 2);
        assert.strictEqual(await client.lpush(key, split), 3);
        assert.strictEqual(await client.lpushx(key, [second]), 4);
        assert.strictEqual(
          await client.linsert(key, 'AFTER', binary, split),
          5,
        );
        assert.deepStrictEqual(await client.lrange(key, 0, -1, buffer), [
          second,
          split,
          binary,
          split,
          second,
        ]);
        assert.strictEqual(await client.lpos(key, binary), 2);
        assert.strictEqual(await client.lrem(key, 1, split), 1);
        assert.strictEqual(await client.lset(key, 0, binary), 'OK');
        assert.deepStrictEqual(await client.lindex(key, 0, buffer), binary);
        assert.deepStrictEqual(await client.lindex(key, -1, buffer), second);

        const single = await client.lpop(key, undefined, buffer);
        const isSingle: IsEqual<typeof single, Buffer | null> = true;

        assert.strictEqual(isSingle, true);
        assert.deepStrictEqual(single, binary);

        const several = await client.rpop(key, 2, buffer);
        const isSeveral: IsEqual<typeof several, Buffer[] | null> = true;

        assert.strictEqual(isSeveral, true);
        assert.deepStrictEqual(several, [second, split]);

        await client.rpush(key, binary, second);

        assert.deepStrictEqual(
          await client.rpoplpush(key, target, buffer),
          second,
        );
        assert.deepStrictEqual(
          await client.lmove(key, target, 'LEFT', 'LEFT', buffer),
          binary,
        );
        assert.deepStrictEqual(await client.lrange(target, 0, -1, buffer), [
          binary,
          second,
        ]);
        assert.deepStrictEqual(await client.lpop(key, 2, buffer), [binary]);
        assert.strictEqual(await client.lpop(key, undefined, buffer), null);
        assert.strictEqual(await client.lpop(key, 2, buffer), null);
      });

      it('reads blocking list pops as bytes', async () => {
        const key = keyspace.key(protocol, 'blocking');
        const target = keyspace.key(protocol, 'blocking-target');

        await client.rpush(key, binary, second, split, binary, second);

        const popped = await client.blpop([key], 1, buffer);
        const isPair: IsEqual<
          typeof popped,
          [key: string, value: Buffer] | null
        > = true;

        assert.strictEqual(isPair, true);
        assert.deepStrictEqual(popped, [key, binary]);
        assert.deepStrictEqual(await client.brpop([key], 1, buffer), [
          key,
          second,
        ]);
        assert.deepStrictEqual(
          await client.brpoplpush(key, target, 1, buffer),
          binary,
        );
        assert.deepStrictEqual(
          await client.blmove(key, target, 'LEFT', 'RIGHT', 1, buffer),
          second,
        );
        assert.deepStrictEqual(await client.lrange(target, 0, -1, buffer), [
          binary,
          second,
        ]);
        assert.strictEqual(
          await client.blpop([keyspace.key(protocol, 'empty')], 0.05, buffer),
          null,
        );
      });

      it('reads LMPOP and BLMPOP elements as bytes', async (context) => {
        if (!isAtLeast7) {
          context.skip('requires Redis 7.0+');
          return;
        }

        const key = keyspace.key(protocol, 'multi-pop');

        await client.rpush(key, binary, second, split);

        const popped = await client.lmpop([key], 'LEFT', 2, buffer);
        const isPopped: IsEqual<typeof popped, RespLmpop<Buffer> | null> = true;

        assert.strictEqual(isPopped, true);
        assert.deepStrictEqual(popped, { key, elements: [binary, second] });
        assert.deepStrictEqual(
          await client.blmpop(1, [key], 'RIGHT', undefined, buffer),
          { key, elements: [split] },
        );
        assert.strictEqual(await client.lmpop([key], 'LEFT', 1, buffer), null);
      });

      it('keeps returned Buffers intact while later replies arrive', async () => {
        const key = keyspace.key(protocol, 'stable');
        const payload = Buffer.alloc(128 * 1024, 0xab);

        await client.set(key, payload);

        const held = await client.get(key, buffer);

        await Promise.all(
          range(200).map((index) =>
            client.set(keyspace.key(protocol, 'noise', index), `${index}`),
          ),
        );
        await client.set(key, Buffer.alloc(128 * 1024, 0xcd));
        await client.get(key, buffer);

        assert.deepStrictEqual(held, payload);
      });

      it('types runtime options as either strings or Buffers', async () => {
        const key = keyspace.key(protocol, 'runtime');

        await client.set(key, binary);

        for (const flag of [true, false]) {
          const options: CommandBufferOptions = { buffer: flag };
          const value = await client.get(key, options);
          const isEither: IsEqual<typeof value, string | Buffer | null> = true;

          assert.strictEqual(isEither, true);
          assert.strictEqual(Buffer.isBuffer(value), flag);
        }
      });
    });
  }
});

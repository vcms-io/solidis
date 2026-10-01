/** Integers beyond Number.MAX_SAFE_INTEGER: explicit errors by default, bigint results with bigIntegers. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../sources/client/featured.ts';
import { bitfieldRo } from '../../../sources/command/bitfield.ro.ts';
import { incr } from '../../../sources/command/incr.ts';
import { llen } from '../../../sources/command/llen.ts';
import { tryReplyToInteger } from '../../../sources/command/utils/reply.ts';
import {
  SolidisClient,
  SolidisCommandError,
  SolidisProtocols,
} from '../../../sources/index.ts';
import {
  buildClientOptions,
  closeClient,
  createKeyspace,
} from '../utils/index.ts';

import type { SolidisClientOptions } from '../../../sources/index.ts';

type IsEqual<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

const maximum = Number.MAX_SAFE_INTEGER;
const beyond = 9007199254740992n;
const unsafeMessage =
  'Unexpected reply: integer exceeds Number.MAX_SAFE_INTEGER';

function isUnsafeIntegerError(commandName: string, value: bigint) {
  return (error: unknown) => {
    assert.ok(error instanceof SolidisCommandError);
    assert.strictEqual(error.message, `[${commandName}] ${unsafeMessage}`);
    assert.strictEqual(error.cause, value);

    return true;
  };
}

describe('big-integers', () => {
  const keyspace = createKeyspace('big-integers');

  for (const protocol of [SolidisProtocols.RESP2, SolidisProtocols.RESP3]) {
    describe(`over ${protocol}`, () => {
      const options = buildClientOptions({ lazyConnect: true, protocol });
      const plain = new SolidisFeaturedClient(options);
      const big = new SolidisFeaturedClient({ ...options, bigIntegers: true });

      before(async () => {
        plain.on('error', () => {});
        big.on('error', () => {});

        await Promise.all([plain.connect(), big.connect()]);
      });

      after(async () => {
        await closeClient(plain);
        await closeClient(big);
      });

      it('exposes the option on the client', () => {
        const isPlainBoolean: IsEqual<typeof plain.bigIntegers, boolean> = true;
        const isBigTrue: IsEqual<typeof big.bigIntegers, true> = true;

        assert.strictEqual(isPlainBoolean, true);
        assert.strictEqual(isBigTrue, true);
        assert.strictEqual(plain.bigIntegers, false);
        assert.strictEqual(big.bigIntegers, true);
      });

      it('returns safe counters as numbers and rejects larger ones by default', async () => {
        const key = keyspace.key(protocol, 'default', 'counter');
        const hash = keyspace.key(protocol, 'default', 'hash');
        const negative = keyspace.key(protocol, 'default', 'negative');

        await plain.set(key, `${maximum - 1}`);

        const value = await plain.incr(key);
        const isNumber: IsEqual<typeof value, number> = true;

        assert.strictEqual(isNumber, true);
        assert.strictEqual(value, maximum);

        await assert.rejects(
          plain.incr(key),
          isUnsafeIntegerError('INCR', beyond),
        );
        assert.strictEqual(await plain.get(key), `${beyond}`);

        await assert.rejects(
          plain.incrby(key, 1n),
          isUnsafeIntegerError('INCRBY', beyond + 1n),
        );
        await assert.rejects(
          plain.decrby(key, 0),
          isUnsafeIntegerError('DECRBY', beyond + 1n),
        );

        await plain.hset(hash, 'field', `${maximum}`);

        await assert.rejects(
          plain.hincrby(hash, 'field', 1),
          isUnsafeIntegerError('HINCRBY', beyond),
        );

        await plain.set(negative, `${-maximum}`);

        await assert.rejects(
          plain.decr(negative),
          isUnsafeIntegerError('DECR', -beyond),
        );
      });

      it('returns every counter result as a bigint with bigIntegers', async () => {
        const key = keyspace.key(protocol, 'big', 'counter');
        const hash = keyspace.key(protocol, 'big', 'hash');
        const negative = keyspace.key(protocol, 'big', 'negative');
        const fresh = await big.incr(keyspace.key(protocol, 'big', 'fresh'));
        const isBigInt: IsEqual<typeof fresh, bigint> = true;

        assert.strictEqual(isBigInt, true);
        assert.strictEqual(fresh, 1n);

        await big.set(key, `${maximum}`);

        assert.strictEqual(await big.incr(key), beyond);
        assert.strictEqual(
          await big.incrby(key, 2n ** 62n),
          beyond + 2n ** 62n,
        );
        assert.strictEqual(await big.decrby(key, 2n ** 62n), beyond);
        assert.strictEqual(await big.decr(key), BigInt(maximum));
        assert.strictEqual(await big.get(key), `${maximum}`);

        await big.hset(hash, 'field', `${maximum}`);

        const field = await big.hincrby(hash, 'field', 2n);
        const isFieldBigInt: IsEqual<typeof field, bigint> = true;

        assert.strictEqual(isFieldBigInt, true);
        assert.strictEqual(field, beyond + 1n);

        await big.set(negative, `${-maximum}`);

        assert.strictEqual(await big.decrby(negative, 5), -beyond - 4n);
      });

      it('reads and writes exact 64-bit bitfields with bigIntegers', async () => {
        const key = keyspace.key(protocol, 'bitfield');
        const exact = 2n ** 62n + 1n;

        const written = await big.bitfield(key, [
          { operation: 'SET', type: 'i64', offset: 0, value: exact },
          { operation: 'GET', type: 'i64', offset: 0 },
        ]);
        const isNullableBigIntList: IsEqual<
          typeof written,
          (bigint | null)[] | null
        > = true;

        assert.strictEqual(isNullableBigIntList, true);
        assert.deepStrictEqual(written, [0n, exact]);
        assert.deepStrictEqual(
          await big.bitfield(
            key,
            [
              {
                operation: 'INCRBY',
                type: 'i64',
                offset: 0,
                increment: 2n ** 62n,
              },
            ],
            'FAIL',
          ),
          [null],
        );

        const read = await big.bitfieldRo(key, [
          { type: 'i64', offset: 0 },
          { type: 'u8', offset: 0 },
        ]);
        const isBigIntList: IsEqual<typeof read, bigint[]> = true;

        assert.strictEqual(isBigIntList, true);
        assert.deepStrictEqual(read, [exact, 64n]);

        const plainRead = await plain.bitfieldRo(key, [
          { type: 'u8', offset: 0 },
        ]);
        const isNumberList: IsEqual<typeof plainRead, number[]> = true;

        assert.strictEqual(isNumberList, true);
        assert.deepStrictEqual(plainRead, [64]);

        await assert.rejects(
          plain.bitfieldRo(key, [{ type: 'i64', offset: 0 }]),
          isUnsafeIntegerError('BITFIELD_RO', exact),
        );
        await assert.rejects(
          plain.bitfield(key, [{ operation: 'GET', type: 'i64', offset: 0 }]),
          isUnsafeIntegerError('BITFIELD', exact),
        );
      });

      it('leaves other commands and raw replies untouched', async () => {
        const list = keyspace.key(protocol, 'untouched', 'list');
        const counter = keyspace.key(protocol, 'untouched', 'counter');
        const small = keyspace.key(protocol, 'untouched', 'small');

        await big.rpush(list, 'a', 'b');

        const length = await big.llen(list);
        const isNumber: IsEqual<typeof length, number> = true;

        assert.strictEqual(isNumber, true);
        assert.strictEqual(length, 2);

        await big.set(counter, `${maximum}`);

        assert.deepStrictEqual(
          await big.send([
            ['INCR', counter],
            ['INCR', small],
          ]),
          [[beyond], [1]],
        );
      });
    });
  }

  it('types tree-shakable clients by their option', async () => {
    const extended = new SolidisClient({
      ...buildClientOptions({ lazyConnect: true }),
      bigIntegers: true,
    }).extend({ incr, bitfieldRo, llen });
    const key = keyspace.key('extended', 'counter');

    extended.on('error', () => {});

    try {
      await extended.connect();
      await extended.send([['SET', key, `${maximum}`]]);

      const value = await extended.incr(key);
      const length = await extended.llen(keyspace.key('extended', 'list'));
      const isBigInt: IsEqual<typeof value, bigint> = true;
      const isNumber: IsEqual<typeof length, number> = true;

      assert.strictEqual(isBigInt, true);
      assert.strictEqual(isNumber, true);
      assert.strictEqual(value, beyond);
      assert.strictEqual(length, 0);
    } finally {
      extended.quit();
    }
  });

  it('keeps number typing unless bigIntegers is the literal true', () => {
    const widenedOptions: SolidisClientOptions = { bigIntegers: true };
    const widened = new SolidisFeaturedClient({
      ...widenedOptions,
      lazyConnect: true,
    });
    const disabled = new SolidisFeaturedClient({
      lazyConnect: true,
      bigIntegers: false,
    });
    const isWidenedNumber: IsEqual<
      Awaited<ReturnType<typeof widened.incr<typeof widened>>>,
      number
    > = true;
    const isDisabledNumber: IsEqual<
      Awaited<ReturnType<typeof disabled.incr<typeof disabled>>>,
      number
    > = true;

    assert.strictEqual(isWidenedNumber, true);
    assert.strictEqual(isDisabledNumber, true);
    assert.strictEqual(disabled.bigIntegers, false);
  });

  it('converts integer replies according to the sender option', () => {
    const command = ['INCR', 'key'];

    assert.strictEqual(tryReplyToInteger(5, command, {}), 5);
    assert.strictEqual(
      tryReplyToInteger(5, command, { bigIntegers: true }),
      5n,
    );
    assert.strictEqual(
      tryReplyToInteger(beyond, command, { bigIntegers: true }),
      beyond,
    );

    for (const sender of [
      {},
      { bigIntegers: false },
      { bigIntegers: 'yes' },
      null,
    ]) {
      assert.throws(
        () => tryReplyToInteger(beyond, command, sender),
        isUnsafeIntegerError('INCR', beyond),
      );
    }

    assert.throws(
      () => tryReplyToInteger('5', command, { bigIntegers: true }),
      {
        name: 'SolidisCommandError',
        message: '[INCR] Unexpected reply: string',
      },
    );
  });
});

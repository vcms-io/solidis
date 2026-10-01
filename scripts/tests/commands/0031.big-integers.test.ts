/** Integers beyond Number.MAX_SAFE_INTEGER: explicit errors by default, bigint results on request. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../sources/client/featured.ts';
import { bitfieldRo } from '../../../sources/command/bitfield.ro.ts';
import { incr } from '../../../sources/command/incr.ts';
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

import type { CommandIntegerOptions } from '../../../sources/index.ts';

type IsEqual<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

type IncrResult<Options extends CommandIntegerOptions | undefined> = Awaited<
  ReturnType<typeof incr<unknown, Options>>
>;

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
      const client = new SolidisFeaturedClient(
        buildClientOptions({ lazyConnect: true, protocol }),
      );

      before(async () => {
        client.on('error', () => {});

        await client.connect();
      });

      after(async () => {
        await closeClient(client);
      });

      it('returns safe counters as numbers and rejects larger ones by default', async () => {
        const key = keyspace.key(protocol, 'default', 'counter');
        const hash = keyspace.key(protocol, 'default', 'hash');
        const negative = keyspace.key(protocol, 'default', 'negative');

        await client.set(key, `${maximum - 1}`);

        const value = await client.incr(key);
        const isNumber: IsEqual<typeof value, number> = true;

        assert.strictEqual(isNumber, true);
        assert.strictEqual(value, maximum);

        await assert.rejects(
          client.incr(key),
          isUnsafeIntegerError('INCR', beyond),
        );
        assert.strictEqual(await client.get(key), `${beyond}`);

        await assert.rejects(
          client.incrby(key, 1n, { bigint: false }),
          isUnsafeIntegerError('INCRBY', beyond + 1n),
        );
        await assert.rejects(
          client.decrby(key, 0, {}),
          isUnsafeIntegerError('DECRBY', beyond + 1n),
        );

        await client.hset(hash, 'field', `${maximum}`);

        await assert.rejects(
          client.hincrby(hash, 'field', 1),
          isUnsafeIntegerError('HINCRBY', beyond),
        );

        await client.set(negative, `${-maximum}`);

        await assert.rejects(
          client.decr(negative),
          isUnsafeIntegerError('DECR', -beyond),
        );
      });

      it('returns every counter result as a bigint on request', async () => {
        const key = keyspace.key(protocol, 'bigint', 'counter');
        const hash = keyspace.key(protocol, 'bigint', 'hash');
        const negative = keyspace.key(protocol, 'bigint', 'negative');
        const options = { bigint: true } as const;

        const fresh = await client.incr(
          keyspace.key(protocol, 'bigint', 'fresh'),
          { bigint: true },
        );
        const isBigInt: IsEqual<typeof fresh, bigint> = true;

        assert.strictEqual(isBigInt, true);
        assert.strictEqual(fresh, 1n);

        await client.set(key, `${maximum}`);

        assert.strictEqual(await client.incr(key, options), beyond);
        assert.strictEqual(
          await client.incrby(key, 2n ** 62n, options),
          beyond + 2n ** 62n,
        );
        assert.strictEqual(
          await client.decrby(key, 2n ** 62n, options),
          beyond,
        );
        assert.strictEqual(await client.decr(key, options), BigInt(maximum));
        assert.strictEqual(await client.get(key), `${maximum}`);

        await client.hset(hash, 'field', `${maximum}`);

        const field = await client.hincrby(hash, 'field', 2n, options);
        const isFieldBigInt: IsEqual<typeof field, bigint> = true;

        assert.strictEqual(isFieldBigInt, true);
        assert.strictEqual(field, beyond + 1n);

        await client.set(negative, `${-maximum}`);

        assert.strictEqual(
          await client.decrby(negative, 5, options),
          -beyond - 4n,
        );
      });

      it('follows an option that is only known at runtime', async () => {
        const key = keyspace.key(protocol, 'runtime');

        for (const bigint of [true, false]) {
          const options: CommandIntegerOptions = { bigint };
          const value = await client.incr(key, options);
          const isEither: IsEqual<typeof value, number | bigint> = true;

          assert.strictEqual(isEither, true);
          assert.strictEqual(typeof value, bigint ? 'bigint' : 'number');
        }
      });

      it('reads and writes exact 64-bit bitfields on request', async () => {
        const key = keyspace.key(protocol, 'bitfield');
        const exact = 2n ** 62n + 1n;

        const written = await client.bitfield(
          key,
          [
            { operation: 'SET', type: 'i64', offset: 0, value: exact },
            { operation: 'GET', type: 'i64', offset: 0 },
          ],
          undefined,
          { bigint: true },
        );
        const isNullableBigIntList: IsEqual<
          typeof written,
          (bigint | null)[] | null
        > = true;

        assert.strictEqual(isNullableBigIntList, true);
        assert.deepStrictEqual(written, [0n, exact]);
        assert.deepStrictEqual(
          await client.bitfield(
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
            { bigint: true },
          ),
          [null],
        );

        const read = await client.bitfieldRo(
          key,
          [
            { type: 'i64', offset: 0 },
            { type: 'u8', offset: 0 },
          ],
          { bigint: true },
        );
        const isBigIntList: IsEqual<typeof read, bigint[]> = true;

        assert.strictEqual(isBigIntList, true);
        assert.deepStrictEqual(read, [exact, 64n]);

        const small = await client.bitfieldRo(key, [{ type: 'u8', offset: 0 }]);
        const isNumberList: IsEqual<typeof small, number[]> = true;

        assert.strictEqual(isNumberList, true);
        assert.deepStrictEqual(small, [64]);

        await assert.rejects(
          client.bitfieldRo(key, [{ type: 'i64', offset: 0 }]),
          isUnsafeIntegerError('BITFIELD_RO', exact),
        );
        await assert.rejects(
          client.bitfield(key, [{ operation: 'GET', type: 'i64', offset: 0 }]),
          isUnsafeIntegerError('BITFIELD', exact),
        );
      });

      it('leaves raw replies untouched', async () => {
        const counter = keyspace.key(protocol, 'raw', 'counter');
        const small = keyspace.key(protocol, 'raw', 'small');

        await client.set(counter, `${maximum}`);

        assert.deepStrictEqual(
          await client.send([
            ['INCR', counter],
            ['INCR', small],
          ]),
          [[beyond], [1]],
        );
      });
    });
  }

  it('types results by the call even when detached or extended', async () => {
    const client = new SolidisFeaturedClient(
      buildClientOptions({ lazyConnect: true }),
    );
    const extended = new SolidisClient(
      buildClientOptions({ lazyConnect: true }),
    ).extend({ incr, bitfieldRo });
    const key = keyspace.key('detached', 'counter');

    client.on('error', () => {});
    extended.on('error', () => {});

    try {
      await Promise.all([client.connect(), extended.connect()]);
      await client.set(key, `${maximum}`);

      const { incr: detachedIncr } = client;
      const detached = await detachedIncr(key, { bigint: true });
      const fromExtension = await extended.incr(key, { bigint: true });
      const fromExtensionDefault = await extended.incr(
        keyspace.key('detached', 'small'),
      );
      const isDetachedBigInt: IsEqual<typeof detached, bigint> = true;
      const isExtensionBigInt: IsEqual<typeof fromExtension, bigint> = true;
      const isExtensionNumber: IsEqual<typeof fromExtensionDefault, number> =
        true;

      assert.strictEqual(isDetachedBigInt, true);
      assert.strictEqual(isExtensionBigInt, true);
      assert.strictEqual(isExtensionNumber, true);
      assert.strictEqual(detached, beyond);
      assert.strictEqual(fromExtension, beyond + 1n);
      assert.strictEqual(fromExtensionDefault, 1);
    } finally {
      await closeClient(client);
      extended.quit();
    }
  });

  it('infers number unless the option is the literal true', () => {
    const checks: [
      IsEqual<IncrResult<undefined>, number>,
      IsEqual<IncrResult<Record<never, never>>, number>,
      IsEqual<IncrResult<{ bigint: false }>, number>,
      IsEqual<IncrResult<{ bigint: true }>, bigint>,
      IsEqual<IncrResult<{ bigint: boolean }>, number | bigint>,
      IsEqual<IncrResult<CommandIntegerOptions>, number | bigint>,
      IsEqual<IncrResult<CommandIntegerOptions | undefined>, number | bigint>,
    ] = [true, true, true, true, true, true, true];

    assert.deepStrictEqual(checks, [true, true, true, true, true, true, true]);
  });

  it('converts integer replies according to the options', () => {
    const command = ['INCR', 'key'];

    assert.strictEqual(tryReplyToInteger(5, command, undefined), 5);
    assert.strictEqual(tryReplyToInteger(5, command, {}), 5);
    assert.strictEqual(tryReplyToInteger(5, command, { bigint: true }), 5n);
    assert.strictEqual(
      tryReplyToInteger(beyond, command, { bigint: true }),
      beyond,
    );

    for (const options of [undefined, {}, { bigint: false }]) {
      assert.throws(
        () => tryReplyToInteger(beyond, command, options),
        isUnsafeIntegerError('INCR', beyond),
      );
    }

    assert.throws(() => tryReplyToInteger('5', command, { bigint: true }), {
      name: 'SolidisCommandError',
      message: '[INCR] Unexpected reply: string',
    });
  });
});

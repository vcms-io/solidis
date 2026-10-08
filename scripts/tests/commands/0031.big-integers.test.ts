/** Integers beyond Number.MAX_SAFE_INTEGER: explicit errors by default, bigint results on request. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../sources/client/featured.ts';
import { bitfieldRo } from '../../../sources/command/bitfield.ro.ts';
import { createCommand as createBitfieldCommand } from '../../../sources/command/bitfield.ts';
import { createCommand as createClientKillCommand } from '../../../sources/command/client.kill.ts';
import { createCommand as createClientListCommand } from '../../../sources/command/client.list.ts';
import { clientTrackinginfo } from '../../../sources/command/client.trackinginfo.ts';
import { createCommand as createDecrbyCommand } from '../../../sources/command/decrby.ts';
import { hello } from '../../../sources/command/hello.ts';
import { createCommand as createHincrbyCommand } from '../../../sources/command/hincrby.ts';
import { createCommand as createHincrbyfloatCommand } from '../../../sources/command/hincrbyfloat.ts';
import { incr } from '../../../sources/command/incr.ts';
import { createCommand as createIncrbyCommand } from '../../../sources/command/incrby.ts';
import { createCommand as createIncrbyfloatCommand } from '../../../sources/command/incrbyfloat.ts';
import { createCommand as createJsonNumincrbyCommand } from '../../../sources/command/json.numincrby.ts';
import { createCommand as createJsonNummultbyCommand } from '../../../sources/command/json.nummultby.ts';
import { latencyHistogram } from '../../../sources/command/latency.histogram.ts';
import { lcs } from '../../../sources/command/lcs.ts';
import { lpop } from '../../../sources/command/lpop.ts';
import { createCommand as createLrangeCommand } from '../../../sources/command/lrange.ts';
import { memoryStats } from '../../../sources/command/memory.stats.ts';
import { createCommand as createPexpireatCommand } from '../../../sources/command/pexpireat.ts';
import { role } from '../../../sources/command/role.ts';
import { createCommand as createSetCommand } from '../../../sources/command/set.ts';
import { createCommand as createSetexCommand } from '../../../sources/command/setex.ts';
import { time } from '../../../sources/command/time.ts';
import { createCommand as createTimeSeriesAddCommand } from '../../../sources/command/ts.add.ts';
import { createCommand as createTimeSeriesDecrbyCommand } from '../../../sources/command/ts.decrby.ts';
import { createCommand as createTimeSeriesIncrbyCommand } from '../../../sources/command/ts.incrby.ts';
import { createCommand as createTimeSeriesMaddCommand } from '../../../sources/command/ts.madd.ts';
import { buildScanCommand } from '../../../sources/command/utils/command.ts';
import { tryReplyToInteger } from '../../../sources/command/utils/reply.ts';
import { createCommand as createXclaimCommand } from '../../../sources/command/xclaim.ts';
import { xinfoConsumers } from '../../../sources/command/xinfo.consumers.ts';
import { xinfoGroups } from '../../../sources/command/xinfo.groups.ts';
import { xinfoStream } from '../../../sources/command/xinfo.stream.ts';
import { xpending } from '../../../sources/command/xpending.ts';
import { createCommand as createZaddCommand } from '../../../sources/command/zadd.ts';
import { createCommand as createZincrbyCommand } from '../../../sources/command/zincrby.ts';
import { createCommand as createZunionstoreCommand } from '../../../sources/command/zunionstore.ts';
import {
  SolidisClient,
  SolidisCommandError,
  SolidisProtocols,
} from '../../../sources/index.ts';
import {
  buildClientOptions,
  closeClient,
  createKeyspace,
  track,
} from '../utils/index.ts';

import type {
  CommandIntegerOptions,
  SolidisData,
  StringOrBuffer,
} from '../../../sources/index.ts';

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
      const client = track(
        new SolidisFeaturedClient(
          buildClientOptions({ lazyConnect: true, protocol }),
        ),
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
        const isNullableBigIntList: IsEqual<typeof written, (bigint | null)[]> =
          true;

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

      it('sends numbers past Number.MAX_SAFE_INTEGER as their exact value', async () => {
        const key = keyspace.key(protocol, 'exact', 'counter');
        const hash = keyspace.key(protocol, 'exact', 'hash');
        const field = keyspace.key(protocol, 'exact', 'bitfield');
        const options = { bigint: true } as const;

        assert.strictEqual(
          await client.incrby(key, 2 ** 60, options),
          2n ** 60n,
        );
        assert.strictEqual(
          await client.decrby(key, 2 ** 61, options),
          -(2n ** 60n),
        );
        assert.strictEqual(
          await client.hincrby(hash, 'field', -(2 ** 62), options),
          -(2n ** 62n),
        );
        assert.deepStrictEqual(
          await client.bitfield(
            field,
            [
              { operation: 'SET', type: 'i64', offset: 0, value: 2 ** 62 },
              {
                operation: 'INCRBY',
                type: 'i64',
                offset: 0,
                increment: -(2 ** 61),
              },
            ],
            undefined,
            options,
          ),
          [0n, 2n ** 61n],
        );
      });

      it('stores a retry count past Number.MAX_SAFE_INTEGER exactly and rejects reading it back', async () => {
        const stream = keyspace.key(protocol, 'exact', 'stream');

        await client.xgroupCreate(stream, 'group', '$', true);

        const id = await client.xadd(stream, '*', { field: 'value' });

        await client.xreadgroup('group', 'alice', [stream], ['>']);
        await client.xclaim(stream, 'group', 'bob', 0, [id], {
          retrycount: 2 ** 60,
          justid: true,
        });
        await assert.rejects(
          client.xpending(stream, 'group', '-', '+', 10),
          isUnsafeIntegerError('XPENDING', 2n ** 60n),
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
    const client = track(
      new SolidisFeaturedClient(buildClientOptions({ lazyConnect: true })),
    );
    const extended = track(
      new SolidisClient(buildClientOptions({ lazyConnect: true })),
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

  it('writes integer arguments exactly and other numbers as JavaScript prints them', () => {
    assert.deepStrictEqual(createIncrbyCommand('key', 2 ** 60), [
      'INCRBY',
      'key',
      '1152921504606846976',
    ]);
    assert.deepStrictEqual(createDecrbyCommand('key', -0), [
      'DECRBY',
      'key',
      '0',
    ]);
    assert.deepStrictEqual(createHincrbyCommand('key', 'field', 2n ** 64n), [
      'HINCRBY',
      'key',
      'field',
      '18446744073709551616',
    ]);
    assert.deepStrictEqual(
      createBitfieldCommand('key', [
        { operation: 'SET', type: 'u63', offset: 0, value: 2 ** 62 },
        { operation: 'INCRBY', type: 'i64', offset: 64, increment: -(2 ** 61) },
      ]),
      [
        'BITFIELD',
        'key',
        'SET',
        'u63',
        '0',
        '4611686018427387904',
        'INCRBY',
        'i64',
        '64',
        '-2305843009213693952',
      ],
    );

    for (const value of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.deepStrictEqual(createIncrbyCommand('key', value), [
        'INCRBY',
        'key',
        `${value}`,
      ]);
    }
  });

  it('rejects integer replies past Number.MAX_SAFE_INTEGER wherever a command reads them', async () => {
    const answering = (reply: SolidisData) => ({
      send: async () => [[reply]],
    });
    const map = (...entries: [string, SolidisData][]) =>
      new Map<string, SolidisData>(entries);
    const text = (value: string) => Buffer.from(value);
    const streamWith = (pending: SolidisData, consumers: SolidisData) =>
      map(
        ['length', 1],
        ['radix-tree-keys', 1],
        ['radix-tree-nodes', 1],
        ['last-generated-id', text('1-0')],
        ['entries', []],
        [
          'groups',
          [
            map(
              ['name', text('group')],
              ['last-delivered-id', text('1-0')],
              ['pel-count', 1],
              ['pending', pending],
              ['consumers', consumers],
            ),
          ],
        ],
      );
    const calls: [string, () => Promise<unknown>][] = [
      [
        'XPENDING',
        () =>
          xpending.call(
            answering([[text('1-0'), text('alice'), 1, beyond]]),
            's',
            'g',
            '-',
            '+',
            10,
          ),
      ],
      [
        'XPENDING',
        () => xpending.call(answering([beyond, null, null, null]), 's', 'g'),
      ],
      [
        'XINFO STREAM',
        () => xinfoStream.call(answering(map(['length', beyond])), 's'),
      ],
      [
        'XINFO STREAM',
        () =>
          xinfoStream.call(
            answering(
              streamWith([[text('1-0'), text('alice'), 1, beyond]], []),
            ),
            's',
            true,
          ),
      ],
      [
        'XINFO STREAM',
        () =>
          xinfoStream.call(
            answering(
              streamWith(
                [],
                [map(['name', text('alice')], ['seen-time', beyond])],
              ),
            ),
            's',
            true,
          ),
      ],
      [
        'XINFO GROUPS',
        () =>
          xinfoGroups.call(
            answering([map(['name', text('g')], ['consumers', beyond])]),
            's',
          ),
      ],
      [
        'XINFO CONSUMERS',
        () =>
          xinfoConsumers.call(
            answering([
              map(['name', text('c')], ['pending', 1], ['idle', beyond]),
            ]),
            's',
            'g',
          ),
      ],
      [
        'ROLE',
        () =>
          role.call(
            answering([
              text('slave'),
              text('host'),
              6379,
              text('connected'),
              beyond,
            ]),
          ),
      ],
      ['HELLO', () => hello.call(answering(map(['proto', 3], ['id', beyond])))],
      [
        'CLIENT TRACKINGINFO',
        () =>
          clientTrackinginfo.call(
            answering(
              map(['flags', []], ['redirect', beyond], ['prefixes', []]),
            ),
          ),
      ],
      [
        'LCS',
        () =>
          lcs.call(
            answering(
              map(
                [
                  'matches',
                  [
                    [
                      [beyond, 1],
                      [2, 3],
                    ],
                  ],
                ],
                ['len', 2],
              ),
            ),
            'a',
            'b',
            { idx: true },
          ),
      ],
      [
        'LCS',
        () =>
          lcs.call(answering(map(['matches', []], ['len', beyond])), 'a', 'b', {
            idx: true,
          }),
      ],
      [
        'MEMORY STATS',
        () => memoryStats.call(answering([text('keys.count'), beyond])),
      ],
      [
        'ROLE',
        () =>
          role.call(
            answering([
              text('master'),
              1,
              [[text('127.0.0.1'), text(`${beyond}`), text('1')]],
            ]),
          ),
      ],
      [
        'ROLE',
        () =>
          role.call(
            answering([
              text('master'),
              1,
              [[text('127.0.0.1'), text('6379'), text(`${beyond}`)]],
            ]),
          ),
      ],
      [
        'XPENDING',
        () =>
          xpending.call(
            answering([
              1,
              text('1-0'),
              text('1-0'),
              [[text('alice'), text(`${beyond}`)]],
            ]),
            's',
            'g',
          ),
      ],
      ['TIME', () => time.call(answering([text(`${beyond}`), text('0')]))],
      [
        'LATENCY HISTOGRAM',
        () =>
          latencyHistogram.call(
            answering(
              map([
                'set',
                map(['calls', 1], ['histogram_usec', map([`${beyond}`, 1])]),
              ]),
            ),
          ),
      ],
    ];

    for (const [name, call] of calls) {
      await assert.rejects(call(), isUnsafeIntegerError(name, beyond));
    }

    const partial = await hello.call(answering(map(['proto', 3])));

    assert.strictEqual(partial.proto, 3);
    assert.ok(Number.isNaN(partial.id));
  });

  it('writes integer arguments exactly and doubles as JavaScript prints them', () => {
    const exact = '1152921504606846976';

    assert.deepStrictEqual(createPexpireatCommand('k', 2 ** 60), [
      'PEXPIREAT',
      'k',
      exact,
    ]);
    assert.deepStrictEqual(
      createSetCommand('k', 'v', { expireAtMilliseconds: 2 ** 60 }),
      ['SET', 'k', 'v', 'PXAT', exact],
    );
    assert.deepStrictEqual(createSetexCommand('k', 2 ** 60, 'v'), [
      'SETEX',
      'k',
      exact,
      'v',
    ]);
    assert.deepStrictEqual(
      createXclaimCommand('s', 'g', 'c', 0, ['1-0'], { retrycount: 2 ** 60 }),
      ['XCLAIM', 's', 'g', 'c', '0', '1-0', 'RETRYCOUNT', exact],
    );
    assert.deepStrictEqual(createTimeSeriesAddCommand('t', 2 ** 60, 0.5, {}), [
      'TS.ADD',
      't',
      exact,
      '0.5',
    ]);
    assert.deepStrictEqual(createTimeSeriesAddCommand('t', '*', 1, {}), [
      'TS.ADD',
      't',
      '*',
      '1',
    ]);
    assert.deepStrictEqual(
      createClientListCommand({ identifiers: [2 ** 60] }),
      ['CLIENT', 'LIST', 'ID', exact],
    );
    assert.deepStrictEqual(createClientKillCommand(2 ** 60), [
      'CLIENT',
      'KILL',
      'ID',
      exact,
    ]);
    assert.deepStrictEqual(createLrangeCommand('k', 0, 2 ** 60), [
      'LRANGE',
      'k',
      '0',
      exact,
    ]);
    assert.deepStrictEqual(createJsonNumincrbyCommand('k', '$', 2 ** 60), [
      'JSON.NUMINCRBY',
      'k',
      '$',
      exact,
    ]);
    assert.deepStrictEqual(createJsonNumincrbyCommand('k', '$', 0.1), [
      'JSON.NUMINCRBY',
      'k',
      '$',
      '0.1',
    ]);
    assert.deepStrictEqual(createIncrbyfloatCommand('k', 2 ** 60), [
      'INCRBYFLOAT',
      'k',
      exact,
    ]);
    assert.deepStrictEqual(createZaddCommand('z', 2 ** 60, 'm'), [
      'ZADD',
      'z',
      `${2 ** 60}`,
      'm',
    ]);
  });

  it('keeps the sign of a zero double argument, which RedisJSON and RedisTimeSeries store', () => {
    assert.deepStrictEqual(createZaddCommand('z', -0, 'm'), [
      'ZADD',
      'z',
      '-0',
      'm',
    ]);
    assert.deepStrictEqual(createTimeSeriesAddCommand('t', 1, -0, {}), [
      'TS.ADD',
      't',
      '1',
      '-0',
    ]);
    assert.deepStrictEqual(createJsonNumincrbyCommand('k', '$', -0), [
      'JSON.NUMINCRBY',
      'k',
      '$',
      '-0',
    ]);
    assert.deepStrictEqual(createIncrbyfloatCommand('k', -0), [
      'INCRBYFLOAT',
      'k',
      '-0',
    ]);
    assert.deepStrictEqual(createPexpireatCommand('k', -0), [
      'PEXPIREAT',
      'k',
      '0',
    ]);

    for (const command of [
      createZincrbyCommand('z', -0, 'm'),
      createZunionstoreCommand('d', ['a'], { weights: [-0] }),
      createTimeSeriesMaddCommand('t', [{ timestamp: 1, value: -0 }]),
      createTimeSeriesIncrbyCommand('t', -0, {}),
      createTimeSeriesDecrbyCommand('t', -0, {}),
      createHincrbyfloatCommand('k', 'f', -0),
      createJsonNummultbyCommand('k', '$', -0),
    ]) {
      assert.ok(command.includes('-0'), command.join(' '));
    }
  });

  it('sends every integer argument exactly', async () => {
    const big = 2 ** 60;
    const exact = '1152921504606846976';
    const chunk = Buffer.from('chunk');
    const cases: [module: string, parameters: unknown[], count: number][] = [
      ['acl.genpass', [big], 1],
      ['acl.log', [big], 1],
      ['bf.insert', ['k', ['i'], { capacity: big, expansion: big }], 2],
      ['bf.loadchunk', ['k', big, chunk], 1],
      ['bf.reserve', ['k', 0.01, big, big], 2],
      ['bf.scandump', ['k', big], 1],
      ['bitcount', ['k', { start: big, end: big }], 2],
      ['bitfield.ro', ['k', [{ type: 'u8', offset: big }]], 1],
      [
        'bitfield',
        [
          'k',
          [
            { operation: 'GET', type: 'u8', offset: big },
            { operation: 'SET', type: 'i64', offset: 0, value: big },
            { operation: 'INCRBY', type: 'i64', offset: 0, increment: big },
          ],
        ],
        3,
      ],
      ['bitpos', ['k', big, { start: big, end: big }], 3],
      ['blmpop', [0, ['k'], 'LEFT', big], 1],
      ['bzmpop', [0, ['k'], 'MIN', big], 1],
      ['cf.insert', ['k', ['i'], { capacity: big }], 1],
      ['cf.loadchunk', ['k', big, chunk], 1],
      ['cf.reserve', ['k', big, big, big, big], 4],
      ['cf.scandump', ['k', big], 1],
      ['client.kill', [big], 1],
      ['client.list', [{ identifiers: [big] }], 1],
      ['client.pause', [big], 1],
      ['client.tracking', ['ON', { redirect: big }], 1],
      ['client.unblock', [big], 1],
      ['copy', ['a', 'b', { destinationDatabase: big }], 1],
      ['decrby', ['k', big], 1],
      ['expire', ['k', big], 1],
      ['failover', [{ to: { host: 'h', port: big }, timeout: big }], 2],
      [
        'geosearch',
        [
          'k',
          { frommember: 'm' },
          { byradius: { radius: 1, unit: 'M' } },
          { count: big },
        ],
        1,
      ],
      ['getbit', ['k', big], 1],
      ['getrange', ['k', big, big], 2],
      ['hexpire', ['k', big, ['f']], 1],
      ['hincrby', ['k', 'f', big], 1],
      ['hincrbyfloat', ['k', 'f', big], 1],
      ['hrandfield', ['k', big], 1],
      ['incrby', ['k', big], 1],
      ['incrbyfloat', ['k', big], 1],
      ['json.arrindex', ['k', '$', '1', { start: big, stop: big }], 2],
      ['json.arrinsert', ['k', '$', big, '1'], 1],
      ['json.arrpop', ['k', '$', big], 1],
      ['json.arrtrim', ['k', '$', { start: big, stop: big }], 2],
      ['json.numincrby', ['k', '$', big], 1],
      ['json.nummultby', ['k', '$', big], 1],
      ['lcs', ['a', 'b', { idx: true, minmatchlen: big }], 1],
      ['lindex', ['k', big], 1],
      ['lmpop', [['k'], 'LEFT', big], 1],
      ['lolwut', [big], 1],
      ['lpos', ['k', 'e', { rank: big, count: big, maxlen: big }], 3],
      ['lrange', ['k', big, big], 2],
      ['lrem', ['k', big, 'e'], 1],
      ['lset', ['k', big, 'e'], 1],
      ['ltrim', ['k', big, big], 2],
      ['memory.usage', ['k', big], 1],
      ['migrate', ['h', big, 'k', big, big], 3],
      ['move', ['k', big], 1],
      ['psetex', ['k', big, 'v'], 1],
      ['replicaof', ['h', big], 1],
      ['restore', ['k', big, 'payload', { idletime: big }], 2],
      ['restore', ['k', 0, 'payload', { freq: big }], 1],
      ['select', [big], 1],
      ['set', ['k', 'v', { expireInSeconds: big }], 1],
      ['set', ['k', 'v', { expireInMilliseconds: big }], 1],
      ['set', ['k', 'v', { expireAtSeconds: big }], 1],
      ['set', ['k', 'v', { expireAtMilliseconds: big }], 1],
      ['setbit', ['k', big, big], 2],
      ['setex', ['k', big, 'v'], 1],
      ['setrange', ['k', big, 'v'], 1],
      ['sintercard', [['k'], big], 1],
      ['slowlog.get', [big], 1],
      ['sort', ['k', { limit: { offset: big, count: big } }], 2],
      ['srandmember', ['k', big], 1],
      ['swapdb', [big, big], 2],
      ['ts.add', ['k', big, 1, {}], 1],
      [
        'ts.create',
        [
          'k',
          {
            retention: big,
            chunkSize: big,
            ignore: { maxTimediff: big, maxValDiff: 1 },
          },
        ],
        3,
      ],
      [
        'ts.createrule',
        [
          'a',
          'b',
          {
            aggregation: {
              type: 'avg',
              bucketDuration: big,
              alignTimestamp: big,
            },
          },
        ],
        2,
      ],
      ['ts.decrby', ['k', 1, { timestamp: big }], 1],
      ['ts.del', ['k', big, big], 2],
      ['ts.incrby', ['k', 1, { timestamp: big }], 1],
      ['ts.madd', ['k', [{ timestamp: big, value: 1 }]], 1],
      ['ts.mrange', [big, big, { area: 'north' }, {}], 2],
      ['ts.mrevrange', [big, big, { area: 'north' }, {}], 2],
      [
        'ts.range',
        [
          'k',
          big,
          big,
          {
            filterByTs: [big],
            count: big,
            aggregation: { type: 'avg', bucketDuration: big },
            align: big,
          },
        ],
        6,
      ],
      ['ts.revrange', ['k', big, big, {}], 2],
      ['wait', [big, big], 2],
      ['waitaof', [big, big, big], 3],
      ['xautoclaim', ['k', 'g', 'c', big, '0', big], 2],
      [
        'xclaim',
        [
          'k',
          'g',
          'c',
          big,
          ['1-0'],
          { idle: big, time: big, retrycount: big },
        ],
        4,
      ],
      ['xgroup.create', ['k', 'g', '$', false, big], 1],
      ['xgroup.setid', ['k', 'g', '$', big], 1],
      ['xinfo.stream', ['k', true, big], 1],
      ['xpending', ['k', 'g', '-', '+', big, 'c', big], 2],
      ['xread', [['k'], ['0'], big, big], 2],
      ['xreadgroup', ['g', 'c', ['k'], ['>'], big, big], 2],
      ['xsetid', ['k', '1-0', big], 1],
      ['xtrim', ['k', big], 1],
      ['zintercard', [['k'], big], 1],
      ['zmpop', [['k'], 'MIN', big], 1],
      ['zpopmax', ['k', big], 1],
      ['zpopmin', ['k', big], 1],
      ['zrandmember', ['k', big], 1],
      ['zrangebylex', ['k', '-', '+', { offset: big, count: big }], 2],
      ['zrangebyscore', ['k', 0, 1, { limit: { offset: big, count: big } }], 2],
      [
        'zrangestore',
        [
          'd',
          's',
          '0',
          '1',
          { byScore: true, limit: { offset: big, count: big } },
        ],
        2,
      ],
      ['zrevrange', ['k', big, big], 2],
    ];

    for (const [module, parameters, count] of cases) {
      const { createCommand } = await import(
        `../../../sources/command/${module}.ts`
      );
      const command: unknown[] = Reflect.apply(
        createCommand,
        undefined,
        parameters,
      );

      assert.strictEqual(
        command.filter((argument) => argument === exact).length,
        count,
        `${module}: ${command.join(' ')}`,
      );
    }

    const sent: StringOrBuffer[][] = [];

    await lpop.call(
      {
        send: async (commands: StringOrBuffer[][]) => {
          sent.push(...commands);

          return [[[]]];
        },
      },
      'k',
      big,
    );

    assert.deepStrictEqual(sent, [['LPOP', 'k', exact]]);
    assert.deepStrictEqual(buildScanCommand(['SCAN'], '0', { count: big }), [
      'SCAN',
      '0',
      'COUNT',
      exact,
    ]);
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

    assert.strictEqual(tryReplyToInteger('5', command, { bigint: true }), 5n);
    assert.throws(() => tryReplyToInteger('five', command, { bigint: true }), {
      name: 'SolidisCommandError',
      message: '[INCR] Unexpected reply: string',
    });
  });
});

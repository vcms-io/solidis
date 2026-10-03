/** Regression coverage for reply conversions that used to lose data or build invalid commands. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { createCommand as createAclCatCommand } from '../../../sources/command/acl.cat.ts';
import { createCommand as createAclGenpassCommand } from '../../../sources/command/acl.genpass.ts';
import { createCommand as createAuthCommand } from '../../../sources/command/auth.ts';
import { createCommand as createBitcountCommand } from '../../../sources/command/bitcount.ts';
import { createCommand as createBitposCommand } from '../../../sources/command/bitpos.ts';
import { createCommand as createFunctionListCommand } from '../../../sources/command/function.list.ts';
import { createCommand as createHelloCommand } from '../../../sources/command/hello.ts';
import { get, incr, info } from '../../../sources/command/index.ts';
import { createCommand as createJsonArrindexCommand } from '../../../sources/command/json.arrindex.ts';
import { createCommand as createLatencyHistogramCommand } from '../../../sources/command/latency.histogram.ts';
import { createCommand as createPubsubChannelsCommand } from '../../../sources/command/pubsub.channels.ts';
import { createCommand as createPubsubShardchannelsCommand } from '../../../sources/command/pubsub.shardchannels.ts';
import { createCommand as createSortCommand } from '../../../sources/command/sort.ts';
import { createCommand as createTsDecrbyCommand } from '../../../sources/command/ts.decrby.ts';
import { createCommand as createTsIncrbyCommand } from '../../../sources/command/ts.incrby.ts';
import { buildScanCommand } from '../../../sources/command/utils/index.ts';
import { createCommand as createZrandmemberCommand } from '../../../sources/command/zrandmember.ts';
import {
  formatDouble,
  getCommandName,
  parseDouble,
  RespError,
  SolidisCommandError,
  SolidisProtocols,
  toCommandError,
} from '../../../sources/index.ts';
import {
  closeClient,
  createClient,
  createKeyspace,
  detectServerCapabilities,
  isCommandSupported,
} from '../utils/index.ts';

import type { SolidisData } from '../../../sources/index.ts';
import type { FeaturedClient } from '../utils/index.ts';

function createSender(reply: SolidisData) {
  return {
    send: async () => [[reply]],
  };
}

async function detectFeatures(client: FeaturedClient, probeKey: string) {
  const [[timeSeriesProbe], [cuckooProbe]] = await client.send([
    ['TS.ADD', `${probeKey}:series`, '1', 'NaN'],
    [
      'CF.RESERVE',
      `${probeKey}:cuckoo`,
      '2',
      'BUCKETSIZE',
      '1',
      'MAXITERATIONS',
      '1',
      'EXPANSION',
      '0',
    ],
  ]);

  return {
    isAtLeast7: (await detectServerCapabilities(client)).atLeast(7, 0),
    hasJson: await isCommandSupported(client, ['JSON.SET']),
    hasJsonMerge: await isCommandSupported(client, ['JSON.MERGE']),
    hasTimeSeries: await isCommandSupported(client, ['TS.CREATE']),
    hasTimeSeriesNaN: !(timeSeriesProbe instanceof RespError),
    hasFullCuckooFilter: !(cuckooProbe instanceof RespError),
  };
}

describe('regressions', () => {
  const keyspace = createKeyspace('regressions');

  for (const protocol of [SolidisProtocols.RESP2, SolidisProtocols.RESP3]) {
    describe(`over ${protocol}`, () => {
      let client: FeaturedClient;
      let features: Awaited<ReturnType<typeof detectFeatures>>;

      before(async () => {
        client = await createClient({ protocol });
        features = await detectFeatures(
          client,
          keyspace.key(protocol, 'probe'),
        );
      });

      after(async () => {
        await closeClient(client);
      });

      it('reads infinite scores', async () => {
        const key = keyspace.key(protocol, 'infinite');

        await client.zadd(key, Number.POSITIVE_INFINITY, 'top');
        await client.zadd(key, Number.NEGATIVE_INFINITY, 'bottom');

        assert.strictEqual(
          await client.zscore(key, 'top'),
          Number.POSITIVE_INFINITY,
        );
        assert.strictEqual(
          await client.zscore(key, 'bottom'),
          Number.NEGATIVE_INFINITY,
        );
        assert.deepStrictEqual(
          await client.zrange(key, '0', '-1', { withScores: true }),
          [
            { member: 'bottom', score: Number.NEGATIVE_INFINITY },
            { member: 'top', score: Number.POSITIVE_INFINITY },
          ],
        );
        assert.strictEqual(
          await client.zincrby(key, 1, 'top'),
          Number.POSITIVE_INFINITY,
        );
        assert.deepStrictEqual(await client.bzpopmin([key], 1), [
          key,
          'bottom',
          '-inf',
        ]);
        assert.deepStrictEqual(await client.bzpopmax([key], 1), [
          key,
          'top',
          'inf',
        ]);
      });

      it('rejects integers beyond Number.MAX_SAFE_INTEGER instead of rounding them', async () => {
        const key = keyspace.key(protocol, 'overflow');
        const hash = keyspace.key(protocol, 'overflow-hash');

        await client.set(key, `${Number.MAX_SAFE_INTEGER - 1}`);

        assert.strictEqual(await client.incr(key), Number.MAX_SAFE_INTEGER);

        await assert.rejects(client.incr(key), {
          name: 'SolidisCommandError',
          message:
            '[INCR] Unexpected reply: integer exceeds Number.MAX_SAFE_INTEGER',
        });
        assert.strictEqual(await client.get(key), '9007199254740992');

        await client.hset(hash, 'field', `${Number.MAX_SAFE_INTEGER}`);

        await assert.rejects(client.hincrby(hash, 'field', 2), {
          message:
            '[HINCRBY] Unexpected reply: integer exceeds Number.MAX_SAFE_INTEGER',
        });
      });

      it('keeps every colon of an INFO value and never yields a format key', async () => {
        const server = await client.info('server');

        assert.match(server.redis_version ?? '', /^\d+\.\d+\.\d+/);
        assert.strictEqual(Object.hasOwn(server, 'txt'), false);

        if (server.listener0 !== undefined) {
          assert.match(server.listener0, /^name=\w+,.*port=\d+$/);
        }
      });

      it('keeps a hash field named __proto__ as an own property', async () => {
        const key = keyspace.key(protocol, 'proto');

        await client.hset(key, '__proto__', 'polluted');
        await client.hset(key, 'constructor', 'kept');

        const hash = await client.hgetall(key);

        assert.strictEqual(Object.getPrototypeOf(hash), Object.prototype);
        assert.deepStrictEqual(Object.keys(hash).sort(), [
          '__proto__',
          'constructor',
        ]);
        assert.strictEqual(
          Object.getOwnPropertyDescriptor(hash, '__proto__')?.value,
          'polluted',
        );
        assert.strictEqual(hash.constructor, 'kept');
        assert.strictEqual(
          (Object.prototype as Record<string, unknown>).polluted,
          undefined,
        );
      });

      it('reports deleted pending entries from XREADGROUP and XAUTOCLAIM', async () => {
        const key = keyspace.key(protocol, 'deleted-pending');

        await client.xadd(key, '1-0', { field: 'one' });
        await client.xadd(key, '2-0', { field: 'two' });
        await client.xgroupCreate(key, 'group', '0');
        await client.xreadgroup('group', 'alice', [key], ['>']);
        await client.xdel(key, '1-0');

        assert.deepStrictEqual(
          await client.xreadgroup('group', 'alice', [key], ['0']),
          [
            {
              stream: key,
              entries: [
                { id: '1-0', fields: null },
                { id: '2-0', fields: { field: 'two' } },
              ],
            },
          ],
        );
        if (!features.isAtLeast7) {
          return;
        }

        assert.deepStrictEqual(
          await client.xautoclaim(key, 'group', 'bob', 0, '0-0'),
          {
            nextId: '0-0',
            entries: [{ id: '2-0', fields: { field: 'two' } }],
            deletedIds: ['1-0'],
          },
        );
      });

      it('reports an unknown consumer group lag as null', async () => {
        const key = keyspace.key(protocol, 'lag');

        await client.xadd(key, '1-0', { field: 'value' });
        await client.xadd(key, '2-0', { field: 'value' });
        await client.xadd(key, '3-0', { field: 'value' });
        await client.xdel(key, '2-0');
        await client.xgroupCreate(key, 'group', '0');

        const [group] = await client.xinfoGroups(key);

        assert.strictEqual(group.name, 'group');
        assert.strictEqual(group.entriesRead, null);
        assert.strictEqual(group.lag, null);
      });

      it('reads NaN samples from a time series', async (context) => {
        if (!features.hasTimeSeriesNaN) {
          context.skip('time series with NaN samples not supported');

          return;
        }

        const key = keyspace.key(protocol, 'nan-series');

        await client.tsCreate(key);
        await client.tsAdd(key, 1, Number.NaN);
        await client.tsAdd(key, 2, 1.5);

        const [missing, present] = await client.tsRange(key, 0, 10);

        assert.strictEqual(missing.timestamp, 1);
        assert.ok(Number.isNaN(missing.value));
        assert.deepStrictEqual(present, { timestamp: 2, value: 1.5 });

        await client.tsAdd(key, 3, Number.NaN);

        const latest = await client.tsGet(key);

        if (latest === null) {
          assert.fail('a non-empty series must have a latest sample');
        }

        assert.strictEqual(latest[0], 3);
        assert.ok(Number.isNaN(latest[1]));
      });

      it('normalizes JSON number updates to the RESP2 text form', async (context) => {
        if (!features.hasJson) {
          context.skip('RedisJSON not loaded');

          return;
        }

        const key = keyspace.key(protocol, 'json-number');

        await client.jsonSet(key, '$', '{"a":1,"nested":{"a":2}}');

        assert.strictEqual(await client.jsonNumincrby(key, '$..a', 2), '[3,4]');
        assert.strictEqual(await client.jsonNumincrby(key, '.a', 1), '4');
        assert.strictEqual(await client.jsonNummultby(key, '$.a', 2), '[8]');
        assert.strictEqual(
          await client.jsonNumincrby(key, '$.a', 0.5),
          '[8.5]',
        );
      });

      it('returns arrays for legacy JSON array and toggle paths', async (context) => {
        if (!features.hasJson) {
          context.skip('RedisJSON not loaded');

          return;
        }

        const key = keyspace.key(protocol, 'json-array');

        await client.jsonSet(key, '$', '{"list":[1,2,3],"flag":true}');

        assert.deepStrictEqual(
          await client.jsonArrappend(key, '.list', '4'),
          [4],
        );
        assert.deepStrictEqual(
          await client.jsonArrindex(key, '.list', '3'),
          [2],
        );
        assert.deepStrictEqual(
          await client.jsonArrindex(key, '$.list', '3', { stop: 2 }),
          [-1],
        );
        assert.deepStrictEqual(
          await client.jsonArrinsert(key, '.list', 0, '0'),
          [5],
        );
        assert.deepStrictEqual(
          await client.jsonArrtrim(key, '.list', { start: 0, stop: 1 }),
          [2],
        );
        assert.deepStrictEqual(await client.jsonToggle(key, '.flag'), [0]);
        assert.deepStrictEqual(await client.jsonToggle(key, '.flag'), [1]);
        assert.deepStrictEqual(await client.jsonToggle(key, '$.flag'), [0]);
      });

      it('merges at the JSON root by default and reports missing keys as null', async (context) => {
        if (!features.hasJsonMerge) {
          context.skip('JSON.MERGE not supported');

          return;
        }

        const key = keyspace.key(protocol, 'json-merge');

        await client.jsonSet(key, '$', '{"a":1}');

        assert.strictEqual(await client.jsonMerge(key, '{"b":2}'), 'OK');
        assert.deepStrictEqual(JSON.parse((await client.jsonGet(key)) ?? ''), {
          a: 1,
          b: 2,
        });
        assert.strictEqual(
          await client.jsonObjkeys(keyspace.key(protocol, 'json-missing')),
          null,
        );
        assert.strictEqual(await client.jsonType(key), 'object');
        assert.strictEqual(await client.jsonType(key, '.a'), 'integer');
        assert.deepStrictEqual(await client.jsonType(key, '$.a'), ['integer']);
      });
    });
  }

  describe('without protocol differences', () => {
    let client: FeaturedClient;
    let features: Awaited<ReturnType<typeof detectFeatures>>;

    before(async () => {
      client = await createClient();
      features = await detectFeatures(client, keyspace.key('probe'));
    });

    after(async () => {
      await closeClient(client);
    });

    it('parses INFO values that contain colons', async () => {
      const sender = createSender(
        Buffer.from(
          '# Server\r\nlistener0:name=tcp,bind=*,bind=-::*,port=6379\r\nredis_version:8.0.0\r\n\r\n# Clients\r\nconnected_clients:1\r\nempty:\r\n',
        ),
      );

      assert.deepStrictEqual(await info.call(sender), {
        listener0: 'name=tcp,bind=*,bind=-::*,port=6379',
        redis_version: '8.0.0',
        connected_clients: '1',
        empty: '',
      });
    });

    it('keeps every value of a key INFO repeats, one per line', async () => {
      const sender = createSender(
        Buffer.from(
          '# Modules\r\nmodule:name=bf,ver=1\r\nmodule:name=search,ver=2\r\nmodule:name=json,ver=3\r\n',
        ),
      );

      assert.deepStrictEqual(await info.call(sender, 'modules'), {
        module: 'name=bf,ver=1\nname=search,ver=2\nname=json,ver=3',
      });
    });

    it('authenticates with an empty password when a username is given', () => {
      assert.deepStrictEqual(createAuthCommand('user', ''), [
        'AUTH',
        'user',
        '',
      ]);
      assert.deepStrictEqual(createAuthCommand(undefined, 'secret'), [
        'AUTH',
        'default',
        'secret',
      ]);
      assert.deepStrictEqual(createAuthCommand('secret'), ['AUTH', 'secret']);
      assert.deepStrictEqual(createHelloCommand('RESP3', 'user', ''), [
        'HELLO',
        '3',
        'AUTH',
        'user',
        '',
      ]);
      assert.deepStrictEqual(createHelloCommand('RESP2', '', ''), [
        'HELLO',
        '2',
      ]);
    });

    it('describes an unexpected reply by its shape only', async () => {
      const shapes: [SolidisData, string][] = [
        [Buffer.from('secret-value'), 'Buffer(12)'],
        [['secret-value'], 'Array(1)'],
        [new Map([['secret', 'value']]), 'Map(1)'],
        [new Set(['secret-value']), 'Set(1)'],
        [true, 'boolean'],
        [null, 'null'],
      ];

      for (const [reply, shape] of shapes) {
        await assert.rejects(incr.call(createSender(reply), 'secret-key'), {
          name: 'SolidisCommandError',
          message: `[INCR] Unexpected reply: ${shape}`,
        });
      }

      await assert.rejects(get.call(createSender(42), 'secret-key'), {
        message: '[GET] Unexpected reply: number',
      });
    });

    it('parses and formats the special double spellings', () => {
      assert.strictEqual(parseDouble('inf'), Number.POSITIVE_INFINITY);
      assert.strictEqual(parseDouble('-inf'), Number.NEGATIVE_INFINITY);
      assert.strictEqual(parseDouble('Infinity'), Number.POSITIVE_INFINITY);
      assert.strictEqual(parseDouble('1.5e3'), 1500);
      assert.ok(Number.isNaN(parseDouble('nan')));
      assert.ok(Number.isNaN(parseDouble('NaN')));
      assert.ok(Number.isNaN(parseDouble('-nan')));

      for (const text of ['', 'Inf', 'abc', '--nan', 'nan-', '1,5']) {
        assert.strictEqual(parseDouble(text), undefined, text);
      }

      assert.strictEqual(formatDouble(Number.NaN), 'nan');
      assert.strictEqual(formatDouble(Number.POSITIVE_INFINITY), 'inf');
      assert.strictEqual(formatDouble(Number.NEGATIVE_INFINITY), '-inf');
      assert.strictEqual(formatDouble(-0.25), '-0.25');
    });

    it('derives a RespError code from the first word of its message', () => {
      assert.strictEqual(
        new RespError('WRONGTYPE Operation against a key').code,
        'WRONGTYPE',
      );
      assert.strictEqual(new RespError('NOSCRIPT').code, 'NOSCRIPT');
      assert.strictEqual(new RespError('').code, '');
    });

    it('names a command by its first token and container subcommand', () => {
      assert.strictEqual(getCommandName([]), '');
      assert.strictEqual(getCommandName(['get', 'key']), 'GET');
      assert.strictEqual(getCommandName(['CONFIG']), 'CONFIG');
      assert.strictEqual(
        getCommandName(['config', 'set', 'requirepass', 'secret']),
        'CONFIG SET',
      );
      assert.strictEqual(
        getCommandName([Buffer.from('client'), Buffer.from('id')]),
        'CLIENT ID',
      );
    });

    it('redacts the arguments a server quotes in an error message', () => {
      const secret = 'hunter2-password-'.repeat(10);
      const korean = `x${'비밀번호'.repeat(40)}`;
      const unknown = 'ERR unknown command';
      const cases: [string[], string, string][] = [
        [
          ['JSON.SET', 'user:1', '$', '{"password":"hunter2"}'],
          `${unknown} \`JSON.SET\`, with args beginning with: \`user:1\`, \`$\`, \`{"password":"hunter2"}\`, `,
          `${unknown} \`JSON.SET\`, with args beginning with: \`***\`, \`***\`, \`***\`, `,
        ],
        [
          ['NOSUCH', 'line1\r\nline2'],
          `${unknown} 'NOSUCH', with args beginning with: 'line1  line2' `,
          `${unknown} 'NOSUCH', with args beginning with: '***' `,
        ],
        [
          ['NOSUCH', secret],
          `${unknown} 'NOSUCH', with args beginning with: '${secret.slice(0, 80)}' `,
          `${unknown} 'NOSUCH', with args beginning with: '***' `,
        ],
        [
          ['NOSUCH', korean],
          `${unknown} 'NOSUCH', with args beginning with: '${Buffer.from(korean).subarray(0, 101)}' `,
          `${unknown} 'NOSUCH', with args beginning with: '***' `,
        ],
      ];

      for (const [command, message, redacted] of cases) {
        const error = toCommandError(new RespError(message), command);

        assert.strictEqual(error.message, `[${command[0]}] ${redacted}`);
        assert.ok(error.cause instanceof RespError);
        assert.strictEqual(error.cause.message, redacted);
      }
    });

    it('keeps the arguments of INCRBY and AUTH out of error messages', async () => {
      const key = keyspace.key('secret-key-name');

      await client.set(key, 'text');

      await assert.rejects(client.incrby(key, 1234567), (error: unknown) => {
        assert.ok(error instanceof SolidisCommandError);
        assert.strictEqual(
          error.message,
          '[INCRBY] ERR value is not an integer or out of range',
        );

        return true;
      });

      await assert.rejects(
        client.auth('solidis-nobody', 'hunter2-password'),
        (error: unknown) => {
          assert.ok(error instanceof SolidisCommandError);
          assert.match(error.message, /^\[AUTH\] WRONGPASS /);
          assert.strictEqual(
            `${error.stack}`.includes('hunter2-password'),
            false,
          );

          return true;
        },
      );

      assert.strictEqual(await client.ping(), 'PONG');
    });

    it('reports null for items a full cuckoo filter rejects', async (context) => {
      if (!features.hasFullCuckooFilter) {
        context.skip('non-expanding cuckoo filters not supported');

        return;
      }

      const key = keyspace.key('cuckoo-full');

      await client.cfReserve(key, 2, 1, 1, 0);

      const items = ['a', 'b', 'c', 'd', 'e', 'f'];
      const results = await client.cfInsert(key, items, { nocreate: true });
      const stored = items.filter((_, index) => results[index] === true);

      assert.strictEqual(results.length, 6);
      assert.strictEqual(
        results.every((result) => result === true || result === null),
        true,
      );
      assert.strictEqual(stored.length, 2);
      assert.deepStrictEqual(
        await client.cfInsertnx(key, ['never-fits', stored[0]], {
          nocreate: true,
        }),
        [null, false],
      );
    });

    it('fills the omitted start of BITPOS and BITCOUNT ranges', async () => {
      const key = keyspace.key('bits');
      const ones = keyspace.key('bits', 'ones');

      assert.deepStrictEqual(createBitcountCommand(key, { end: 5 }), [
        'BITCOUNT',
        key,
        '0',
        '5',
      ]);
      assert.deepStrictEqual(
        createBitposCommand(key, 1, { end: 5, mode: 'BIT' }),
        ['BITPOS', key, '1', '0', '5', 'BIT'],
      );
      assert.deepStrictEqual(
        createBitposCommand(key, 0, { mode: 'BYTE' } as never),
        ['BITPOS', key, '0'],
      );

      await client.send([['SET', key, Buffer.from([0xff, 0xf0, 0x00])]]);
      await client.send([['SET', ones, Buffer.from([0xff, 0xff])]]);

      assert.strictEqual(await client.bitcount(key, { end: 0 }), 8);
      assert.strictEqual(await client.bitpos(key, 0, { end: 1 }), 12);
      assert.strictEqual(await client.bitpos(ones, 0), 16);
      assert.strictEqual(await client.bitpos(ones, 0, { start: 0 }), 16);
      assert.strictEqual(
        await client.bitpos(ones, 0, { start: 0, end: -1 }),
        -1,
      );

      if (!features.isAtLeast7) {
        return;
      }

      assert.strictEqual(
        await client.bitcount(key, { end: 11, mode: 'BIT' }),
        12,
      );
      assert.strictEqual(
        await client.bitpos(key, 1, { start: 12, end: -1, mode: 'BIT' }),
        -1,
      );
    });

    it('limits ZINTERCARD', async (context) => {
      if (!features.isAtLeast7) {
        context.skip('ZINTERCARD requires Redis 7.0+');

        return;
      }

      const first = keyspace.key('card', 'first');
      const second = keyspace.key('card', 'second');

      for (const member of ['x', 'y', 'z']) {
        await client.zadd(first, 1, member);
        await client.zadd(second, 2, member);
      }

      assert.strictEqual(await client.zintercard([first, second]), 3);
      assert.strictEqual(await client.zintercard([first, second], 2), 2);
    });

    it('keeps ZRANDMEMBER scores without a count', async () => {
      const single = keyspace.key('card', 'single');

      await client.zadd(single, 5, 'only');

      assert.deepStrictEqual(
        createZrandmemberCommand(single, undefined, true),
        ['ZRANDMEMBER', single, '1', 'WITHSCORES'],
      );
      assert.deepStrictEqual(
        await client.zrandmember(single, undefined, true),
        [{ member: 'only', score: 5 }],
      );
    });

    it('stores SORT results through the STORE overload', async () => {
      const list = keyspace.key('sort', 'source');
      const destination = keyspace.key('sort', 'destination');

      await client.rpush(list, '3', '1', '2');

      assert.strictEqual(await client.sort(list, { store: destination }), 3);
      assert.deepStrictEqual(await client.lrange(destination, 0, -1), [
        '1',
        '2',
        '3',
      ]);
      assert.deepStrictEqual(await client.sort(list), ['1', '2', '3']);
      assert.deepStrictEqual(await client.sort(list, { store: undefined }), [
        '1',
        '2',
        '3',
      ]);
    });

    it('reports core types upper-cased and module types as the server names them', async (context) => {
      if (!features.hasJson || !features.hasTimeSeries) {
        context.skip('RedisJSON and RedisTimeSeries not loaded');

        return;
      }

      const json = keyspace.key('type', 'json');
      const series = keyspace.key('type', 'series');

      await client.jsonSet(json, '$', '{}');
      await client.tsCreate(series);

      assert.strictEqual(await client.type(json), 'ReJSON-RL');
      assert.strictEqual(await client.type(series), 'TSDB-TYPE');
      assert.strictEqual(
        await client.type(keyspace.key('type', 'none')),
        'NONE',
      );
    });

    it('applies EXPIRE modes', async (context) => {
      if (!features.isAtLeast7) {
        context.skip('EXPIRE modes require Redis 7.0+');

        return;
      }

      const key = keyspace.key('expire-mode');

      await client.set(key, 'value');

      assert.strictEqual(await client.expire(key, 100, 'XX'), 0);
      assert.strictEqual(await client.expire(key, 100, 'NX'), 1);
      assert.strictEqual(await client.expire(key, 100, 'NX'), 0);
      assert.strictEqual(await client.expire(key, 50, 'GT'), 0);
      assert.strictEqual(await client.expire(key, 200, 'GT'), 1);
      assert.strictEqual(await client.expire(key, 300, 'LT'), 0);
      assert.strictEqual(await client.expire(key, 10, 'LT'), 1);
    });

    it('pops several elements with LPOP and RPOP counts', async () => {
      const key = keyspace.key('pop-count');

      await client.rpush(key, 'a', 'b', 'c');

      assert.deepStrictEqual(await client.lpop(key, 2), ['a', 'b']);
      assert.deepStrictEqual(await client.rpop(key, 5), ['c']);
      assert.strictEqual(await client.lpop(key, 2), null);
      assert.strictEqual(await client.rpop(key), null);
    });

    it('stores distances with GEOSEARCHSTORE STOREDIST', async () => {
      const source = keyspace.key('geo', 'source');
      const destination = keyspace.key('geo', 'destination');

      await client.geoadd(source, [
        { longitude: 13.361389, latitude: 38.115556, member: 'Palermo' },
        { longitude: 15.087269, latitude: 37.502669, member: 'Catania' },
      ]);

      assert.strictEqual(
        await client.geosearchstore(
          destination,
          source,
          { fromlonlat: { longitude: 15, latitude: 37 } },
          { byradius: { radius: 200, unit: 'KM' } },
          { storedist: true },
        ),
        2,
      );

      const distance = await client.zscore(destination, 'Catania');

      if (distance === null) {
        assert.fail('Catania must be stored');
      }

      assert.ok(distance > 50 && distance < 60, `distance ${distance} km`);
    });

    it('sends start 0 when JSON.ARRINDEX only has a stop', () => {
      assert.deepStrictEqual(
        createJsonArrindexCommand('key', '$.list', '3', { stop: 2 }),
        ['JSON.ARRINDEX', 'key', '$.list', '3', '0', '2'],
      );
    });

    it('sends empty-string and zero arguments instead of dropping them', () => {
      assert.deepStrictEqual(createAclCatCommand(''), ['ACL', 'CAT', '']);
      assert.deepStrictEqual(createAclGenpassCommand(0), [
        'ACL',
        'GENPASS',
        '0',
      ]);
      assert.deepStrictEqual(createPubsubChannelsCommand(''), [
        'PUBSUB',
        'CHANNELS',
        '',
      ]);
      assert.deepStrictEqual(createPubsubShardchannelsCommand(''), [
        'PUBSUB',
        'SHARDCHANNELS',
        '',
      ]);
      assert.deepStrictEqual(
        createFunctionListCommand({ libraryNamePattern: '' }),
        ['FUNCTION', 'LIST', 'LIBRARYNAME', ''],
      );
      assert.deepStrictEqual(
        buildScanCommand(['SCAN'], '0', { count: 0, match: '', type: '' }),
        ['SCAN', '0', 'COUNT', '0', 'MATCH', '', 'TYPE', ''],
      );
      assert.deepStrictEqual(createSortCommand('list', { store: undefined }), [
        'SORT',
        'list',
      ]);
    });

    it('sends TIMESTAMP with TS.INCRBY and TS.DECRBY, and LATENCY HISTOGRAM without events', () => {
      assert.deepStrictEqual(
        createTsIncrbyCommand('series', 2, { timestamp: '*' }),
        ['TS.INCRBY', 'series', '2', 'TIMESTAMP', '*'],
      );
      assert.deepStrictEqual(
        createTsDecrbyCommand('series', 3, { timestamp: 0, retention: 10 }),
        ['TS.DECRBY', 'series', '3', 'TIMESTAMP', '0', 'RETENTION', '10'],
      );
      assert.deepStrictEqual(createTsIncrbyCommand('series', 1, {}), [
        'TS.INCRBY',
        'series',
        '1',
      ]);
      assert.deepStrictEqual(createLatencyHistogramCommand(), [
        'LATENCY',
        'HISTOGRAM',
      ]);
    });
  });
});

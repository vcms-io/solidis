/** Replies that differ by protocol, connection mode or module version reach callers in one shape. */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { bfMadd } from '../../../sources/command/bf.madd.ts';
import { commandDocs } from '../../../sources/command/command.docs.ts';
import { hrandfield } from '../../../sources/command/hrandfield.ts';
import { jsonType } from '../../../sources/command/json.type.ts';
import { ping } from '../../../sources/command/ping.ts';
import { tsInfo } from '../../../sources/command/ts.info.ts';
import { tsMadd } from '../../../sources/command/ts.madd.ts';
import { RespError, SolidisProtocols } from '../../../sources/index.ts';
import {
  closeClient,
  createClient,
  createKeyspace,
  isCommandSupported,
} from '../utils/index.ts';

import type { SolidisData } from '../../../sources/index.ts';
import type { FeaturedClient } from '../utils/index.ts';

function createSender(reply: SolidisData) {
  return {
    send: async () => [[reply]],
  };
}

function bulk(text: string) {
  return Buffer.from(text);
}

const emptyInfo = {
  totalSamples: 0,
  memoryUsage: 0,
  firstTimestamp: 0,
  lastTimestamp: 0,
  retentionTime: 0,
  chunkCount: 0,
  chunkSize: 0,
  chunkType: '',
  duplicatePolicy: null,
  labels: {},
  sourceKey: null,
  rules: [],
  ignoreMaxTimeDiff: 0,
  ignoreMaxValDiff: 0,
};

describe('normalized-replies', () => {
  const keyspace = createKeyspace('normalized-replies');

  describe('from recorded shapes', () => {
    it('answers PING with PONG or the echo on a subscribed RESP2 connection', async () => {
      assert.strictEqual(
        await ping.call(createSender([bulk('pong'), bulk('')])),
        'PONG',
      );
      assert.strictEqual(
        await ping.call(createSender([bulk('pong'), bulk('hello')]), 'hello'),
        'hello',
      );
      assert.strictEqual(
        await ping.call(createSender([bulk('pong'), bulk('')]), ''),
        '',
      );
      assert.strictEqual(await ping.call(createSender('PONG')), 'PONG');
      assert.strictEqual(
        await ping.call(createSender(bulk('hello')), 'hello'),
        'hello',
      );

      await assert.rejects(ping.call(createSender([bulk('pong')])), {
        message: '[PING] Unexpected reply: undefined',
      });
      await assert.rejects(ping.call(createSender(1)), {
        message: '[PING] Unexpected reply: number',
      });
    });

    it('reads JSON.TYPE the same for every protocol and module version', async () => {
      const cases: [SolidisData, string | undefined, unknown][] = [
        [null, undefined, null],
        [[null], undefined, null],
        [bulk('object'), undefined, 'object'],
        [[bulk('object')], undefined, 'object'],
        [bulk('integer'), '.a', 'integer'],
        [[bulk('integer')], '.a', 'integer'],
        [[null], '.missing', null],
        [null, '$', null],
        [[null], '$', null],
        [[bulk('object')], '$', ['object']],
        [[[bulk('object')]], '$', ['object']],
        [[], '$.missing', []],
        [[[]], '$.missing', []],
        [[bulk('integer'), bulk('string')], '$..a', ['integer', 'string']],
        [[[bulk('integer'), bulk('string')]], '$..a', ['integer', 'string']],
      ];

      for (const [reply, path, expected] of cases) {
        const sender = { ...createSender(reply), jsonType };
        const actual =
          path === undefined
            ? await sender.jsonType('key')
            : await sender.jsonType('key', path);

        assert.deepStrictEqual(actual, expected, `${path}`);
      }

      await assert.rejects(
        { ...createSender(bulk('date')), jsonType }.jsonType('key'),
        { message: '[JSON.TYPE] Unexpected reply: Buffer(4)' },
      );
    });

    it('keeps every HRANDFIELD entry, duplicates included', async () => {
      const flat = [bulk('a'), bulk('1'), bulk('a'), bulk('1'), bulk('b')];
      const entries = [
        { field: 'a', value: '1' },
        { field: 'a', value: '1' },
        { field: 'b', value: '2' },
      ];

      assert.deepStrictEqual(
        await hrandfield.call(
          createSender([...flat, bulk('2')]),
          'key',
          -3,
          true,
        ),
        entries,
      );
      assert.deepStrictEqual(
        await hrandfield.call(
          createSender([
            [bulk('a'), bulk('1')],
            [bulk('a'), bulk('1')],
            [bulk('b'), bulk('2')],
          ]),
          'key',
          -3,
          true,
        ),
        entries,
      );

      await assert.rejects(
        hrandfield.call(createSender(flat), 'key', -3, true),
        {
          message:
            '[HRANDFIELD] Unexpected reply: expected even-length array, got 5',
        },
      );
    });

    it('reads TS.INFO from RESP2 arrays, RESP3 maps and older modules', async () => {
      const expected = {
        ...emptyInfo,
        totalSamples: 2,
        memoryUsage: 4268,
        firstTimestamp: 1000,
        lastTimestamp: 2000,
        retentionTime: 60000,
        chunkCount: 1,
        chunkSize: 4096,
        chunkType: 'compressed',
        duplicatePolicy: 'block',
        labels: { sensor: 'a', room: 'kitchen' },
        rules: [
          {
            key: 'average',
            bucketDuration: 1000,
            aggregator: 'AVG',
            alignment: 0,
          },
          {
            key: 'peak',
            bucketDuration: 60000,
            aggregator: 'MAX',
            alignment: 5,
          },
        ],
        ignoreMaxTimeDiff: 10,
        ignoreMaxValDiff: 0.5,
      };
      const head = [
        'totalSamples',
        2,
        'memoryUsage',
        4268,
        'firstTimestamp',
        1000,
        'lastTimestamp',
        2000,
        'retentionTime',
        60000,
        'chunkCount',
        1,
        'chunkSize',
        4096,
        'chunkType',
        'compressed',
        'duplicatePolicy',
        'block',
      ];

      const resp2 = [
        ...head,
        'labels',
        [
          [bulk('sensor'), bulk('a')],
          [bulk('room'), bulk('kitchen')],
        ],
        'sourceKey',
        null,
        'rules',
        [
          [bulk('average'), 1000, 'AVG', 0],
          [bulk('peak'), 60000, 'MAX', 5],
        ],
        'ignoreMaxTimeDiff',
        10,
        'ignoreMaxValDiff',
        bulk('0.5'),
        'keySelfName',
        bulk('series'),
      ];
      const resp3 = new Map<string, SolidisData>([
        ['totalSamples', 2],
        ['memoryUsage', 4268],
        ['firstTimestamp', 1000],
        ['lastTimestamp', 2000],
        ['retentionTime', 60000],
        ['chunkCount', 1],
        ['chunkSize', 4096],
        ['chunkType', 'compressed'],
        ['duplicatePolicy', 'block'],
        [
          'labels',
          new Map([
            ['sensor', bulk('a')],
            ['room', bulk('kitchen')],
          ]),
        ],
        ['sourceKey', null],
        [
          'rules',
          new Map([
            ['average', [1000, 'AVG', 0]],
            ['peak', [60000, 'MAX', 5]],
          ]),
        ],
        ['ignoreMaxTimeDiff', 10],
        ['ignoreMaxValDiff', 0.5],
      ]);
      const legacy = [
        ...head.slice(0, -1),
        null,
        'labels',
        [],
        'sourceKey',
        bulk('source'),
        'rules',
        [[bulk('average'), 1000, 'AVG']],
      ];

      assert.deepStrictEqual(
        await tsInfo.call(createSender(resp2), 'key'),
        expected,
      );
      assert.deepStrictEqual(
        await tsInfo.call(createSender(resp3), 'key'),
        expected,
      );
      assert.deepStrictEqual(await tsInfo.call(createSender(legacy), 'key'), {
        ...expected,
        duplicatePolicy: null,
        labels: {},
        sourceKey: 'source',
        rules: [
          {
            key: 'average',
            bucketDuration: 1000,
            aggregator: 'AVG',
            alignment: 0,
          },
        ],
        ignoreMaxTimeDiff: 0,
        ignoreMaxValDiff: 0,
      });

      await assert.rejects(tsInfo.call(createSender(bulk('info')), 'key'), {
        message: '[TS.INFO] Unexpected reply: Buffer(4)',
      });
      await assert.rejects(
        tsInfo.call(createSender(['rules', [bulk('average')]]), 'key'),
        { message: '[TS.INFO] Unexpected reply: Buffer(7)' },
      );
    });

    it('reads COMMAND DOCS history from RESP2 arrays and RESP3 sets', async () => {
      const history = [
        [bulk('2.6.12'), bulk('Added the EX option.')],
        [bulk('7.0.0'), bulk('Allowed GET.')],
      ];
      const replies: SolidisData[] = [
        [
          bulk('set'),
          [bulk('summary'), bulk('Sets'), bulk('history'), history],
        ],
        new Map([
          [
            'set',
            new Map<string, SolidisData>([
              ['summary', bulk('Sets')],
              ['history', new Set(history)],
            ]),
          ],
        ]),
      ];

      for (const reply of replies) {
        const docs = await commandDocs.call(createSender(reply));

        assert.deepStrictEqual(docs.set.history, [
          '2.6.12: Added the EX option.',
          '7.0.0: Allowed GET.',
        ]);
      }

      await assert.rejects(
        commandDocs.call(
          createSender([bulk('set'), [bulk('history'), bulk('none')]]),
        ),
        { message: '[COMMAND DOCS] Unexpected reply: Buffer(4)' },
      );
    });

    it('returns per-item errors inline from multi-item writes', async () => {
      const failure = new RespError('ERR TSDB: invalid timestamp');
      const full = new RespError('ERR non scaling filter is full');

      assert.deepStrictEqual(
        await tsMadd.call(createSender([5, failure, 7]), 'key', [
          { timestamp: 5, value: 1 },
          { timestamp: -1, value: 1 },
          { timestamp: 7, value: 1 },
        ]),
        [5, failure, 7],
      );
      assert.deepStrictEqual(
        await bfMadd.call(createSender([true, false, full]), 'key', [
          'a',
          'b',
          'c',
          'd',
        ]),
        [1, 0, full],
      );

      await assert.rejects(
        tsMadd.call(createSender([5, bulk('x')]), 'key', [
          { timestamp: 5, value: 1 },
        ]),
        { message: '[TS.MADD] Unexpected reply: Buffer(1)' },
      );
    });
  });

  for (const protocol of [SolidisProtocols.RESP2, SolidisProtocols.RESP3]) {
    describe(`over ${protocol}`, () => {
      let client: FeaturedClient;
      let hasJson = false;
      let hasTimeSeries = false;

      before(async () => {
        client = await createClient({ protocol });
        hasJson = await isCommandSupported(client, ['JSON.SET']);
        hasTimeSeries = await isCommandSupported(client, ['TS.CREATE']);
      });

      after(async () => {
        await closeClient(client);
      });

      it('answers PING while subscribed', async () => {
        const subscriber = await createClient({ protocol });

        try {
          await subscriber.subscribe(keyspace.key(protocol, 'channel'));

          assert.strictEqual(await subscriber.ping(), 'PONG');
          assert.strictEqual(await subscriber.ping('hello'), 'hello');
          assert.strictEqual(await subscriber.ping(''), '');

          await subscriber.unsubscribe(keyspace.key(protocol, 'channel'));

          assert.strictEqual(await subscriber.ping(), 'PONG');
        } finally {
          await closeClient(subscriber);
        }
      });

      it('reads JSON.TYPE for missing and present keys', async (context) => {
        if (!hasJson) {
          context.skip('RedisJSON not loaded');
          return;
        }

        const key = keyspace.key(protocol, 'json');

        assert.strictEqual(await client.jsonType(key), null);
        assert.strictEqual(await client.jsonType(key, '$'), null);
        assert.strictEqual(await client.jsonType(key, '.'), null);

        await client.jsonSet(key, '$', '{"a":1,"b":[1],"c":{"a":"x"}}');

        assert.strictEqual(await client.jsonType(key), 'object');
        assert.strictEqual(await client.jsonType(key, '.b'), 'array');
        assert.deepStrictEqual(await client.jsonType(key, '$'), ['object']);
        assert.deepStrictEqual(await client.jsonType(key, '$..a'), [
          'integer',
          'string',
        ]);
        assert.deepStrictEqual(await client.jsonType(key, '$.missing'), []);
      });

      it('keeps duplicate HRANDFIELD entries for negative counts', async () => {
        const key = keyspace.key(protocol, 'hash');

        await client.hset(key, 'only', 'value');

        assert.deepStrictEqual(
          await client.hrandfield(key, -4, true),
          Array.from({ length: 4 }, () => ({ field: 'only', value: 'value' })),
        );
        assert.deepStrictEqual(await client.hrandfield(key, -2), [
          'only',
          'only',
        ]);
      });

      it('reads TS.INFO and partial TS.MADD failures in one shape', async (context) => {
        if (!hasTimeSeries) {
          context.skip('RedisTimeSeries not loaded');
          return;
        }

        const source = keyspace.key(protocol, 'series');
        const destination = keyspace.key(protocol, 'series-average');

        await client.tsCreate(source, {
          retention: 60000,
          duplicatePolicy: 'BLOCK',
          labels: { sensor: 'a', room: 'kitchen' },
        });
        await client.tsCreate(destination);
        await client.tsCreaterule(source, destination, {
          aggregation: { type: 'avg', bucketDuration: 1000 },
        });

        const results = await client.tsMadd(source, [
          { timestamp: 1000, value: 1 },
          { timestamp: 1000, value: 2 },
          { timestamp: 2000, value: 3 },
        ]);

        assert.strictEqual(results[0], 1000);
        assert.ok(results[1] instanceof RespError);
        assert.strictEqual(results[2], 2000);

        const info = await client.tsInfo(source);

        assert.strictEqual(info.totalSamples, 2);
        assert.strictEqual(info.firstTimestamp, 1000);
        assert.strictEqual(info.lastTimestamp, 2000);
        assert.strictEqual(info.retentionTime, 60000);
        assert.strictEqual(info.duplicatePolicy, 'block');
        assert.deepStrictEqual(info.labels, { sensor: 'a', room: 'kitchen' });
        assert.strictEqual(info.sourceKey, null);
        assert.deepStrictEqual(info.rules, [
          {
            key: destination,
            bucketDuration: 1000,
            aggregator: 'AVG',
            alignment: 0,
          },
        ]);
        assert.strictEqual(
          (await client.tsInfo(destination)).sourceKey,
          source,
        );
      });
    });
  }
});

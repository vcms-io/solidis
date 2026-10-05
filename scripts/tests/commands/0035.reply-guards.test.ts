/** Commands that cannot run against a shared server, and replies only older or other servers send. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aclGetuser } from '../../../sources/command/acl.getuser.ts';
import { aclLog } from '../../../sources/command/acl.log.ts';
import {
  bfInsert,
  createCommand as createBloomInsertCommand,
} from '../../../sources/command/bf.insert.ts';
import { createCommand as createBitcountCommand } from '../../../sources/command/bitcount.ts';
import { cfInfo } from '../../../sources/command/cf.info.ts';
import { createCommand as createCuckooInsertCommand } from '../../../sources/command/cf.insert.ts';
import { createCommand as createClientListCommand } from '../../../sources/command/client.list.ts';
import { createCommand as createClientTrackingCommand } from '../../../sources/command/client.tracking.ts';
import {
  commandDocs,
  createCommand as createCommandDocsCommand,
} from '../../../sources/command/command.docs.ts';
import { delex } from '../../../sources/command/delex.ts';
import { dump } from '../../../sources/command/dump.ts';
import { failover } from '../../../sources/command/failover.ts';
import { createCommand as createFunctionFlushCommand } from '../../../sources/command/function.flush.ts';
import { functionStats } from '../../../sources/command/function.stats.ts';
import { get } from '../../../sources/command/get.ts';
import { createCommand as createGetsetCommand } from '../../../sources/command/getset.ts';
import { createCommand as createHashExpireCommand } from '../../../sources/command/hexpire.ts';
import { hmget } from '../../../sources/command/hmget.ts';
import { createCommand as createHmsetCommand } from '../../../sources/command/hmset.ts';
import { hset } from '../../../sources/command/hset.ts';
import { createCommand as createHsetnxCommand } from '../../../sources/command/hsetnx.ts';
import { createCommand as createJsonArrpopCommand } from '../../../sources/command/json.arrpop.ts';
import { createCommand as createJsonGetCommand } from '../../../sources/command/json.get.ts';
import { latencyLatest } from '../../../sources/command/latency.latest.ts';
import { createCommand as createLatencyResetCommand } from '../../../sources/command/latency.reset.ts';
import { lcs } from '../../../sources/command/lcs.ts';
import { lrange } from '../../../sources/command/lrange.ts';
import { memoryStats } from '../../../sources/command/memory.stats.ts';
import { mget } from '../../../sources/command/mget.ts';
import {
  createCommand as createMigrateCommand,
  migrate,
} from '../../../sources/command/migrate.ts';
import {
  createCommand as createModuleLoadCommand,
  moduleLoad,
} from '../../../sources/command/module.load.ts';
import {
  createCommand as createModuleLoadexCommand,
  moduleLoadex,
} from '../../../sources/command/module.loadex.ts';
import { moduleUnload } from '../../../sources/command/module.unload.ts';
import { createCommand as createMsetCommand } from '../../../sources/command/mset.ts';
import { createCommand as createMsetnxCommand } from '../../../sources/command/msetnx.ts';
import { createCommand as createPsetexCommand } from '../../../sources/command/psetex.ts';
import { createCommand as createPublishCommand } from '../../../sources/command/publish.ts';
import { createCommand as createPubsubNumsubCommand } from '../../../sources/command/pubsub.numsub.ts';
import { createCommand as createPubsubShardnumsubCommand } from '../../../sources/command/pubsub.shardnumsub.ts';
import { replconf } from '../../../sources/command/replconf.ts';
import { replicaof } from '../../../sources/command/replicaof.ts';
import { createCommand as createRpushxCommand } from '../../../sources/command/rpushx.ts';
import { set } from '../../../sources/command/set.ts';
import { createCommand as createSetexCommand } from '../../../sources/command/setex.ts';
import { createCommand as createSetnxCommand } from '../../../sources/command/setnx.ts';
import { createCommand as createSetrangeCommand } from '../../../sources/command/setrange.ts';
import { shutdown } from '../../../sources/command/shutdown.ts';
import { createCommand as createSmismemberCommand } from '../../../sources/command/smismember.ts';
import { createCommand as createSpublishCommand } from '../../../sources/command/spublish.ts';
import { createCommand as createTimeSeriesCreateCommand } from '../../../sources/command/ts.create.ts';
import { createCommand as createTimeSeriesMrangeCommand } from '../../../sources/command/ts.mrange.ts';
import { createCommand as createTimeSeriesMrevrangeCommand } from '../../../sources/command/ts.mrevrange.ts';
import { createCommand as createTimeSeriesRangeCommand } from '../../../sources/command/ts.range.ts';
import { createCommand as createTimeSeriesRevrangeCommand } from '../../../sources/command/ts.revrange.ts';
import { tryReplyToNumber } from '../../../sources/command/utils/reply.ts';
import { createCommand as createXaddCommand } from '../../../sources/command/xadd.ts';
import { xautoclaim } from '../../../sources/command/xautoclaim.ts';
import { xinfoStream } from '../../../sources/command/xinfo.stream.ts';
import { createCommand as createXpendingCommand } from '../../../sources/command/xpending.ts';
import { createCommand as createXreadCommand } from '../../../sources/command/xread.ts';
import { createCommand as createXreadgroupCommand } from '../../../sources/command/xreadgroup.ts';
import { createCommand as createZinterCommand } from '../../../sources/command/zinter.ts';
import { zrange } from '../../../sources/command/zrange.ts';
import {
  RespError,
  SolidisConnectionError,
  SolidisRequesterError,
} from '../../../sources/index.ts';

import type { SolidisData, StringOrBuffer } from '../../../sources/index.ts';

function createRecorder(reply: SolidisData) {
  const commands: StringOrBuffer[][] = [];

  return {
    commands,
    send: async (batch: StringOrBuffer[][]) => {
      commands.push(...batch);

      return [[reply]];
    },
  };
}

function bulk(text: string) {
  return Buffer.from(text);
}

describe('reply-guards', () => {
  it('reads time-series labels as a record of names and values', () => {
    assert.deepStrictEqual(
      createTimeSeriesCreateCommand('k', { labels: { area: 'north' } }),
      ['TS.CREATE', 'k', 'LABELS', 'area', 'north'],
    );
    assert.throws(
      () =>
        createTimeSeriesCreateCommand('k', {
          labels: ['area', 'north'] as never,
        }),
      { message: '[TS.CREATE] Expected an object of names and values' },
    );
  });
  it('reads only a connection lost after SHUTDOWN was sent as a shutdown, from any build', async () => {
    class ForeignConnectionError extends Error {
      public name = 'SolidisConnectionError';
    }

    const failing = (error: Error) => ({
      send: () => Promise.reject(error),
    });
    const lost = new ForeignConnectionError('Connection closed.');
    const refusal = new RespError('ERR max number of clients reached');
    const refused = new ForeignConnectionError(refusal.message, {
      cause: refusal,
    });
    const unsent = new SolidisRequesterError(
      'Socket is not connected.',
      new SolidisConnectionError('Connection closed.'),
    );

    assert.strictEqual(
      await shutdown.call(failing(lost), { nosave: true }),
      'OK',
    );

    for (const error of [refused, unsent]) {
      await assert.rejects(shutdown.call(failing(error)), error);
    }

    await assert.rejects(shutdown.call(failing(lost), { abort: true }), lost);
  });
  it('sends server administration commands and reads their replies', async () => {
    const recorder = createRecorder('OK');

    assert.strictEqual(
      await shutdown.call(recorder, { nosave: true, now: true }),
      'OK',
    );
    assert.strictEqual(
      await failover.call(recorder, {
        to: { host: '10.0.0.2', port: 6380 },
        timeout: 500,
        force: true,
      }),
      'OK',
    );
    assert.strictEqual(
      await moduleLoad.call(recorder, '/modules/a.so', ['x']),
      'OK',
    );
    assert.strictEqual(
      await moduleLoadex.call(recorder, '/modules/b.so', { size: '1' }, ['y']),
      'OK',
    );
    assert.strictEqual(await moduleUnload.call(recorder, 'b'), 'OK');
    assert.strictEqual(
      await replconf.call(recorder, 'listening-port', '6380'),
      'OK',
    );
    assert.strictEqual(await replicaof.call(recorder, 'NO', 0), 'OK');
    assert.strictEqual(
      await migrate.call(recorder, '10.0.0.2', 6380, 'key', 0, 1000, {
        auth: 'secret',
        copy: true,
      }),
      'OK',
    );

    assert.deepStrictEqual(recorder.commands, [
      ['SHUTDOWN', 'NOSAVE', 'NOW'],
      ['FAILOVER', 'TO', '10.0.0.2', '6380', 'FORCE', 'TIMEOUT', '500'],
      ['MODULE', 'LOAD', '/modules/a.so', 'x'],
      ['MODULE', 'LOADEX', '/modules/b.so', 'CONFIG', 'size', '1', 'ARGS', 'y'],
      ['MODULE', 'UNLOAD', 'b'],
      ['REPLCONF', 'listening-port', '6380'],
      ['REPLICAOF', 'NO', '0'],
      [
        'MIGRATE',
        '10.0.0.2',
        '6380',
        'key',
        '0',
        '1000',
        'COPY',
        'AUTH',
        'secret',
      ],
    ]);

    assert.strictEqual(
      await migrate.call(createRecorder('NOKEY'), 'h', 1, 'key', 0, 10),
      'NOKEY',
    );
    await assert.rejects(
      migrate.call(createRecorder(1), 'h', 1, 'key', 0, 10),
      { message: '[MIGRATE] Unexpected reply: number' },
    );
    await assert.rejects(
      shutdown.call(createRecorder(new RespError('ERR x'))),
      {
        message: '[SHUTDOWN] ERR x',
      },
    );
    await assert.rejects(shutdown.call(createRecorder(bulk('OK'))), {
      message: '[SHUTDOWN] Unexpected reply: Buffer(2)',
    });
  });

  it('builds commands with more arguments than one call can spread', () => {
    const items = Array.from({ length: 200_000 }, (_, index) => `${index}`);
    const numbers = items.map(Number);
    const commands = [
      createBloomInsertCommand('key', items),
      createCuckooInsertCommand('key', items),
      createHashExpireCommand('key', 60, items),
      createZinterCommand(items, { weights: numbers }),
      createClientListCommand({ identifiers: numbers }),
      createJsonGetCommand('key', { path: items }),
      createMigrateCommand('host', 6379, '', 0, 1000, { keys: items }),
      createPubsubNumsubCommand(items),
      createPubsubShardnumsubCommand(items),
      createXreadCommand(items, items),
      createXreadgroupCommand('group', 'consumer', items, items),
      createCommandDocsCommand(items),
      createModuleLoadCommand('path', items),
      createModuleLoadexCommand('path', undefined, items),
      createTimeSeriesRangeCommand('key', '-', '+', { filterByTs: numbers }),
      createTimeSeriesRevrangeCommand('key', '-', '+', { filterByTs: numbers }),
    ];

    for (const command of commands) {
      assert.strictEqual(command.at(-1), '199999');
    }

    for (const createCommand of [
      createTimeSeriesMrangeCommand,
      createTimeSeriesMrevrangeCommand,
    ]) {
      const command = createCommand(
        '-',
        '+',
        { label: 'value' },
        { filterByTs: numbers },
      );

      assert.deepStrictEqual(command.slice(-3), [
        '199999',
        'FILTER',
        'label=value',
      ]);
      assert.strictEqual(command.length, 200_006);
    }

    assert.deepStrictEqual(createPubsubNumsubCommand(), ['PUBSUB', 'NUMSUB']);
    assert.deepStrictEqual(createPubsubShardnumsubCommand(), [
      'PUBSUB',
      'SHARDNUMSUB',
    ]);
  });

  it('refuses a digest that is not 16 hexadecimal digits before sending it', async () => {
    const recorder = createRecorder(null);

    for (const digest of ['abc', 'zzzzzzzzzzzzzzzz', '0123456789abcdef0']) {
      await assert.rejects(
        set.call(recorder, 'k', 'v', {
          setIfDigestEquals: digest,
          returnOldValue: true,
        }),
        { message: '[SET] Digests must be 16 hexadecimal digits' },
      );
      await assert.rejects(
        delex.call(recorder, 'k', { ifDigestNotEquals: digest }),
        { message: '[DELEX] Digests must be 16 hexadecimal digits' },
      );
    }

    assert.deepStrictEqual(recorder.commands, []);

    await set.call(recorder, 'k', 'v', {
      setIfDigestEquals: '0123456789ABCDEF',
    });

    assert.deepStrictEqual(recorder.commands, [
      ['SET', 'k', 'v', 'IFDEQ', '0123456789ABCDEF'],
    ]);
  });

  it('shapes a reply by the options and arrays the call was made with', async () => {
    const scored = { withScores: true };
    const ranged = zrange.call(
      createRecorder([bulk('a'), bulk('1')]),
      'z',
      '0',
      '-1',
      scored,
    );

    scored.withScores = false;

    const binary = { buffer: true };
    const read = get.call(createRecorder(bulk('v')), 'k', binary);

    binary.buffer = false;

    const previous: { returnOldValue?: boolean } = { returnOldValue: true };
    const replaced = set.call(createRecorder(bulk('old')), 'k', 'v', previous);

    delete previous.returnOldValue;

    const items = ['a', 'b', 'c'];
    const full = new RespError('ERR non scaling filter is full');
    const inserted = bfInsert.call(createRecorder([1, full]), 'bf', items);

    items.length = 0;

    assert.deepStrictEqual(await ranged, [{ member: 'a', score: 1 }]);
    assert.deepStrictEqual(await read, bulk('v'));
    assert.strictEqual(await replaced, 'old');
    assert.deepStrictEqual(await inserted, [1, full, full]);
  });

  it('sets several hash fields in one HSET', async () => {
    const recorder = createRecorder(2);

    assert.strictEqual(
      await hset.call(recorder, 'h', { a: '1', b: bulk('2') }),
      2,
    );
    assert.strictEqual(await hset.call(recorder, 'h', 'c', '3'), 2);
    assert.deepStrictEqual(recorder.commands, [
      ['HSET', 'h', 'a', '1', 'b', bulk('2')],
      ['HSET', 'h', 'c', '3'],
    ]);
  });

  it('refuses a key or field that is not a string instead of dropping it', async () => {
    const recorder = createRecorder([bulk('a'), null]);
    const missing = undefined as unknown as string;

    await assert.rejects(mget.call(recorder, 'a', missing, 'b'), {
      name: 'SolidisCommandError',
      message: '[MGET] Keys must be strings',
    });
    await assert.rejects(hmget.call(recorder, 'h', 'a', missing, 'b'), {
      name: 'SolidisCommandError',
      message: '[HMGET] Fields must be strings',
    });
    for (const last of [5, null, Buffer.from('b'), true]) {
      await assert.rejects(
        mget.call(recorder, 'a', last as unknown as string),
        { message: '[MGET] Keys must be strings' },
      );
      await assert.rejects(
        hmget.call(recorder, 'h', 'a', last as unknown as string),
        { message: '[HMGET] Fields must be strings' },
      );
    }

    assert.deepStrictEqual(recorder.commands, []);
    assert.deepStrictEqual(await mget.call(recorder, 'a', 'b', undefined), [
      'a',
      null,
    ]);
    assert.deepStrictEqual(
      await hmget.call(recorder, 'h', 'a', 'b', undefined),
      ['a', null],
    );
    assert.deepStrictEqual(
      await hmget.call(recorder, 'h', 'a', 'b', { buffer: true }),
      [bulk('a'), null],
    );
    assert.deepStrictEqual(recorder.commands, [
      ['MGET', 'a', 'b'],
      ['HMGET', 'h', 'a', 'b'],
      ['HMGET', 'h', 'a', 'b'],
    ]);
  });

  it('keeps a Buffer value byte for byte in every write that takes one', () => {
    const value = Buffer.from([0xff, 0x00, 0xfe]);
    const commands = [
      createSetnxCommand('k', value),
      createSetexCommand('k', 1, value),
      createPsetexCommand('k', 1, value),
      createGetsetCommand('k', value),
      createSetrangeCommand('k', 0, value),
      createMsetCommand({ k: value }),
      createHmsetCommand('k', { f: value }),
      createHsetnxCommand('k', 'f', value),
      createRpushxCommand('k', [value]),
      createSmismemberCommand('k', [value]),
      createPublishCommand('c', value),
      createSpublishCommand('c', value),
      createXaddCommand('k', '*', { f: value }),
    ];

    for (const command of commands) {
      assert.strictEqual(command.at(-1), value);
    }
  });

  it('sends an empty selection as given, or refuses one that would select everything', () => {
    assert.deepStrictEqual(createClientListCommand({ identifiers: [] }), [
      'CLIENT',
      'LIST',
      'ID',
    ]);
    assert.deepStrictEqual(
      createTimeSeriesRangeCommand('key', '-', '+', { filterByTs: [] }),
      ['TS.RANGE', 'key', '-', '+', 'FILTER_BY_TS'],
    );
    assert.deepStrictEqual(
      createMigrateCommand('host', 6379, '', 0, 1000, { keys: [] }),
      ['MIGRATE', 'host', '6379', '', '0', '1000', 'KEYS'],
    );
    assert.deepStrictEqual(
      createZinterCommand(['a', 'b'], { weights: [], withScores: true }),
      ['ZINTER', '2', 'a', 'b', 'WEIGHTS', 'WITHSCORES'],
    );
    assert.deepStrictEqual(createLatencyResetCommand(), ['LATENCY', 'RESET']);
    assert.throws(() => createLatencyResetCommand([]), {
      name: 'SolidisCommandError',
      message:
        '[LATENCY RESET] An empty list of events would reset every event',
    });
    assert.throws(
      () => createClientTrackingCommand('ON', { bcast: true, prefixes: [] }),
      {
        name: 'SolidisCommandError',
        message:
          '[CLIENT TRACKING] An empty list of prefixes would track every key',
      },
    );
    assert.deepStrictEqual(
      createClientTrackingCommand('ON', { bcast: true, prefixes: ['a', 'b'] }),
      ['CLIENT', 'TRACKING', 'ON', 'PREFIX', 'a', 'PREFIX', 'b', 'BCAST'],
    );
    assert.throws(() => createCommandDocsCommand([]), {
      name: 'SolidisCommandError',
      message:
        '[COMMAND DOCS] An empty list of commands would return every command',
    });
  });

  it('refuses fields that are not an object, as ioredis-style calls pass them', async () => {
    const pairs: Record<string, string> = JSON.parse('"f1"');
    const refusal = (name: string) => ({
      name: 'SolidisCommandError',
      message: `[${name}] Expected an object of names and values`,
    });

    assert.throws(() => createMsetCommand(pairs), refusal('MSET'));
    assert.throws(() => createMsetnxCommand(pairs), refusal('MSETNX'));
    assert.throws(() => createHmsetCommand('h', pairs), refusal('HMSET'));
    assert.throws(() => createXaddCommand('s', '*', pairs), refusal('XADD'));

    const flat: Record<string, string> = JSON.parse('["f1", "v1"]');

    assert.throws(() => createMsetCommand(flat), refusal('MSET'));
    assert.throws(() => createHmsetCommand('h', flat), refusal('HMSET'));
    assert.throws(() => createXaddCommand('s', '*', flat), refusal('XADD'));
    await assert.rejects(
      Reflect.apply(hset, createRecorder(2), ['h', 'f1', 'v1', 'f2', 'v2']),
      refusal('HSET'),
    );
    assert.deepStrictEqual(createMsetCommand({ a: '1', b: '2' }), [
      'MSET',
      'a',
      '1',
      'b',
      '2',
    ]);
  });

  it('rejects a malformed LCS match instead of dropping it', async () => {
    const reply = (matches: SolidisData) =>
      createRecorder(
        new Map<string, SolidisData>([
          ['matches', matches],
          ['len', 4],
        ]),
      );

    assert.deepStrictEqual(
      await lcs.call(reply([[[0, 1], [2, 3], 2]]), 'a', 'b', {
        idx: true,
        withmatchlen: true,
      }),
      { matches: [{ a: [0, 1], b: [2, 3], length: 2 }], length: 4 },
    );

    for (const matches of [
      [bulk('bad')],
      [[[0, 1], bulk('bad')]],
      [[bulk('bad'), [2, 3]]],
      null,
    ]) {
      await assert.rejects(lcs.call(reply(matches), 'a', 'b', { idx: true }), {
        name: 'SolidisCommandError',
        message: /^\[LCS\] Unexpected reply: /,
      });
    }
  });

  it('builds the optional parts of BF.INSERT, BITCOUNT, JSON.ARRPOP, XPENDING and FUNCTION FLUSH', () => {
    assert.deepStrictEqual(createFunctionFlushCommand(), ['FUNCTION', 'FLUSH']);
    assert.deepStrictEqual(createFunctionFlushCommand(true), [
      'FUNCTION',
      'FLUSH',
      'ASYNC',
    ]);
    assert.deepStrictEqual(createFunctionFlushCommand(false), [
      'FUNCTION',
      'FLUSH',
      'SYNC',
    ]);
    assert.deepStrictEqual(
      createBloomInsertCommand('key', ['a'], {
        expansion: 2,
        nonScaling: true,
      }),
      ['BF.INSERT', 'key', 'EXPANSION', '2', 'NONSCALING', 'ITEMS', 'a'],
    );
    assert.deepStrictEqual(createBitcountCommand('key', { mode: 'BIT' }), [
      'BITCOUNT',
      'key',
      '0',
      '-1',
      'BIT',
    ]);
    assert.deepStrictEqual(createBitcountCommand('key', { end: 5 }), [
      'BITCOUNT',
      'key',
      '0',
      '5',
    ]);
    assert.deepStrictEqual(createJsonArrpopCommand('key', '$.items', -1), [
      'JSON.ARRPOP',
      'key',
      '$.items',
      '-1',
    ]);
    assert.deepStrictEqual(createJsonArrpopCommand('key', undefined, 0), [
      'JSON.ARRPOP',
      'key',
      '.',
      '0',
    ]);
    assert.deepStrictEqual(createXpendingCommand('key', 'group', '-', '+', 5), [
      'XPENDING',
      'key',
      'group',
      '-',
      '+',
      '5',
    ]);
    assert.deepStrictEqual(
      createXpendingCommand('key', 'group', '-', '+', 5, 'reader', 1000),
      ['XPENDING', 'key', 'group', 'IDLE', '1000', '-', '+', '5', 'reader'],
    );
    assert.deepStrictEqual(createXpendingCommand('key', 'group'), [
      'XPENDING',
      'key',
      'group',
    ]);
  });

  it('reads replies of older servers and other module versions', async () => {
    assert.deepStrictEqual(
      await cfInfo.call(
        createRecorder([bulk('Size'), 8, bulk('Fresh field'), 1]),
        'key',
      ),
      {
        size: 8,
        numberOfBuckets: 0,
        numberOfFilter: 0,
        numberOfItemsInserted: 0,
        numberOfItemsDeleted: 0,
        bucketSize: 0,
        expansionRate: 0,
        maxIteration: 0,
      },
    );

    assert.deepStrictEqual(
      await latencyLatest.call(
        createRecorder([[bulk('command'), 1700000000, 5, 20, 40, 3]]),
      ),
      [
        {
          event: 'command',
          timestamp: 1700000000,
          latency: 5,
          maximumLatency: 20,
          sum: 40,
          count: 3,
        },
      ],
    );

    assert.deepStrictEqual(
      await aclGetuser.call(
        createRecorder([
          bulk('flags'),
          [bulk('on')],
          bulk('passwords'),
          [],
          bulk('selectors'),
          [
            [bulk('keys'), bulk('~a:*')],
            [bulk('commands'), bulk('+get')],
          ],
        ]),
        'user',
      ),
      {
        flags: ['on'],
        passwords: [],
        commands: '',
        keys: '',
        channels: '',
        selectors: [
          { commands: '', keys: '~a:*', channels: '' },
          { commands: '+get', keys: '', channels: '' },
        ],
      },
    );
    assert.deepStrictEqual(
      await aclGetuser.call(
        createRecorder([
          bulk('flags'),
          [bulk('on'), bulk('allkeys')],
          bulk('passwords'),
          [],
          bulk('commands'),
          bulk('+@all'),
          bulk('keys'),
          bulk('*'),
          bulk('channels'),
          bulk('*'),
        ]),
        'legacy',
      ),
      {
        flags: ['on', 'allkeys'],
        passwords: [],
        commands: '+@all',
        keys: '*',
        channels: '*',
        selectors: [],
      },
    );
    assert.deepStrictEqual(
      await aclGetuser.call(
        createRecorder([
          bulk('flags'),
          [bulk('on')],
          bulk('passwords'),
          [],
          bulk('commands'),
          bulk('+get'),
          bulk('keys'),
          [bulk('foo*'), bulk('bar,baz*')],
          bulk('channels'),
          [bulk('chan*')],
        ]),
        'patterns',
      ),
      {
        flags: ['on'],
        passwords: [],
        commands: '+get',
        keys: '~foo* ~bar,baz*',
        channels: '&chan*',
        selectors: [],
      },
    );

    assert.deepStrictEqual(
      await xautoclaim.call(
        createRecorder([bulk('0-0'), [[bulk('1-1'), [bulk('f'), bulk('v')]]]]),
        'stream',
        'group',
        'consumer',
        0,
        '0',
      ),
      {
        nextId: '0-0',
        entries: [{ id: '1-1', fields: { f: 'v' } }],
        deletedIds: [],
      },
    );
  });

  it('maps every ACL LOG field and skips fields it does not know', async () => {
    assert.deepStrictEqual(
      await aclLog.call(
        createRecorder([
          [
            bulk('count'),
            2,
            bulk('reason'),
            bulk('command'),
            bulk('context'),
            bulk('toplevel'),
            bulk('object'),
            bulk('get'),
            bulk('username'),
            bulk('default'),
            bulk('age-seconds'),
            bulk('1.5'),
            bulk('client-info'),
            bulk('id=7'),
            bulk('entry-id'),
            3,
            bulk('timestamp-created'),
            4,
            bulk('timestamp-last-updated'),
            5,
            bulk('fresh-field'),
            bulk('ignored'),
          ],
        ]),
      ),
      [
        {
          count: 2,
          reason: 'command',
          context: 'toplevel',
          object: 'get',
          username: 'default',
          ageSeconds: 1.5,
          clientInfo: 'id=7',
          entryId: 3,
          timestampCreated: 4,
          timestampLastUpdated: 5,
        },
      ],
    );
  });

  it('reports the ACL LOG fields that Redis 6.2 leaves out as null', async () => {
    const [entry] = await aclLog.call(
      createRecorder([
        [
          bulk('count'),
          1,
          bulk('reason'),
          bulk('auth'),
          bulk('username'),
          bulk('nobody'),
        ],
      ]),
    );

    assert.strictEqual(entry.entryId, null);
    assert.strictEqual(entry.timestampCreated, null);
    assert.strictEqual(entry.timestampLastUpdated, null);
  });

  it('reports the MEMORY STATS fields a server leaves out as 0', async () => {
    const stats = await memoryStats.call(
      createRecorder([bulk('peak.allocated'), 100]),
    );

    assert.strictEqual(stats.peak.allocated, 100);
    assert.strictEqual(stats.functions.caches, 0);
    assert.strictEqual(stats.overhead.db.hashtable.lut, 0);
    assert.strictEqual(stats.dbDict.rehashingCount, 0);
    assert.strictEqual(stats.cluster.links, 0);
  });

  it('resolves SHUTDOWN when the server closes the connection, unless it was aborted', async () => {
    const closing = {
      send: async () => {
        throw new SolidisConnectionError('Connection closed.');
      },
    };

    assert.strictEqual(await shutdown.call(closing, { nosave: true }), 'OK');
    await assert.rejects(shutdown.call(closing, { abort: true }), {
      name: 'SolidisConnectionError',
    });
  });

  it('reads running scripts and engine counters from FUNCTION STATS', async () => {
    const engines = new Map([
      [
        'LUA',
        new Map<string, SolidisData>([
          ['libraries_count', 2],
          ['functions_count', 3],
        ]),
      ],
    ]);
    const stats = await functionStats.call(
      createRecorder(
        new Map<string, SolidisData>([
          [
            'running_script',
            new Map<string, SolidisData>([
              ['name', bulk('slow')],
              ['command', [bulk('FCALL'), bulk('slow'), bulk('0')]],
              ['duration_ms', 1500],
            ]),
          ],
          ['engines', engines],
        ]),
      ),
    );

    assert.deepStrictEqual(stats, {
      runningScript: {
        name: 'slow',
        command: 'FCALL slow 0',
        duration: 1500,
      },
      engines: [{ name: 'LUA', libraries: 2, functions: 3 }],
    });
    assert.deepStrictEqual(
      await functionStats.call(
        createRecorder(
          new Map<string, SolidisData>([
            ['running_script', null],
            ['engines', new Map()],
          ]),
        ),
      ),
      { runningScript: null, engines: [] },
    );
  });

  it('reads nested COMMAND DOCS subcommands and keeps only known doc flags', async () => {
    const docs = await commandDocs.call(
      createRecorder([
        bulk('client'),
        [
          bulk('summary'),
          bulk('A container'),
          bulk('subcommands'),
          [
            bulk('client|kill'),
            [
              bulk('summary'),
              bulk('Terminates connections'),
              bulk('doc_flags'),
              [bulk('deprecated'), bulk('nondeterministic_output')],
            ],
          ],
        ],
      ]),
    );

    assert.deepStrictEqual(docs.client.subcommands?.['client|kill'].docFlags, [
      'deprecated',
    ]);
    assert.strictEqual(
      docs.client.subcommands?.['client|kill'].summary,
      'Terminates connections',
    );
  });

  it('reads XINFO STREAM of empty streams and servers without lag tracking', async () => {
    const base = [
      bulk('length'),
      0,
      bulk('radix-tree-keys'),
      0,
      bulk('radix-tree-nodes'),
      1,
      bulk('last-generated-id'),
      bulk('0-0'),
      bulk('max-deleted-entry-id'),
      bulk('0-0'),
      bulk('entries-added'),
      0,
      bulk('groups'),
    ];
    const summary = await xinfoStream.call(
      createRecorder([
        ...base,
        0,
        bulk('first-entry'),
        null,
        bulk('last-entry'),
        null,
      ]),
      'stream',
    );

    if (!('firstEntry' in summary)) {
      assert.fail('expected the summary form');
    }

    assert.strictEqual(summary.firstEntry, null);
    assert.strictEqual(summary.lastEntry, null);

    const full = await xinfoStream.call(
      createRecorder([
        ...base,
        [
          [
            bulk('name'),
            bulk('group'),
            bulk('last-delivered-id'),
            bulk('0-0'),
            bulk('pel-count'),
            0,
            bulk('pending'),
            [],
            bulk('consumers'),
            [],
          ],
        ],
        bulk('entries'),
        [],
        bulk('recorded-first-entry-id'),
        bulk('0-0'),
      ]),
      'stream',
      true,
    );

    if (!('entries' in full)) {
      assert.fail('expected the FULL form');
    }

    assert.ok(!('firstEntry' in full) && !('lastEntry' in full));

    assert.deepStrictEqual(full.groups, [
      {
        name: 'group',
        lastDeliveredId: '0-0',
        entriesRead: null,
        lag: null,
        pelCount: 0,
        pending: [],
        consumers: [],
      },
    ]);
  });

  it('names unexpected replies by their kind and keeps exact integers out of numbers', async () => {
    await assert.rejects(
      lrange.call(createRecorder([new RespError('ERR element')]), 'key', 0, -1),
      { message: '[LRANGE] Unexpected reply: RespError' },
    );
    assert.strictEqual(await dump.call(createRecorder(null), 'missing'), null);
    assert.throws(() => tryReplyToNumber(2n ** 60n, 'TEST'), {
      message:
        '[TEST] Unexpected reply: integer exceeds Number.MAX_SAFE_INTEGER',
    });
  });
});

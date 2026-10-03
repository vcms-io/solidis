/** Commands that cannot run against a shared server, and replies only older or other servers send. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aclGetuser } from '../../../sources/command/acl.getuser.ts';
import { aclLog } from '../../../sources/command/acl.log.ts';
import { createCommand as createBloomInsertCommand } from '../../../sources/command/bf.insert.ts';
import { createCommand as createBitcountCommand } from '../../../sources/command/bitcount.ts';
import { cfInfo } from '../../../sources/command/cf.info.ts';
import { commandDocs } from '../../../sources/command/command.docs.ts';
import { dump } from '../../../sources/command/dump.ts';
import { failover } from '../../../sources/command/failover.ts';
import { functionStats } from '../../../sources/command/function.stats.ts';
import { createCommand as createJsonArrpopCommand } from '../../../sources/command/json.arrpop.ts';
import { latencyLatest } from '../../../sources/command/latency.latest.ts';
import { lrange } from '../../../sources/command/lrange.ts';
import { memoryStats } from '../../../sources/command/memory.stats.ts';
import { migrate } from '../../../sources/command/migrate.ts';
import { moduleLoad } from '../../../sources/command/module.load.ts';
import { moduleLoadex } from '../../../sources/command/module.loadex.ts';
import { moduleUnload } from '../../../sources/command/module.unload.ts';
import { replconf } from '../../../sources/command/replconf.ts';
import { replicaof } from '../../../sources/command/replicaof.ts';
import { shutdown } from '../../../sources/command/shutdown.ts';
import { tryReplyToNumber } from '../../../sources/command/utils/reply.ts';
import { xautoclaim } from '../../../sources/command/xautoclaim.ts';
import { xinfoStream } from '../../../sources/command/xinfo.stream.ts';
import { createCommand as createXpendingCommand } from '../../../sources/command/xpending.ts';
import { RespError, SolidisConnectionError } from '../../../sources/index.ts';

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

  it('builds the optional parts of BF.INSERT, BITCOUNT, JSON.ARRPOP and XPENDING', () => {
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
    assert.deepStrictEqual(createXpendingCommand('key', 'group', '-'), [
      'XPENDING',
      'key',
      'group',
      '-',
      '+',
      '10',
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
          ['libraries', 2],
          ['functions', 3],
        ]),
      ],
    ]);

    const scriptCommands: SolidisData[] = [
      [bulk('FCALL'), bulk('slow'), bulk('0')],
      bulk('FCALL slow 0'),
    ];

    for (const scriptCommand of scriptCommands) {
      const stats = await functionStats.call(
        createRecorder(
          new Map<string, SolidisData>([
            [
              'running_script',
              new Map<string, SolidisData>([
                ['name', bulk('slow')],
                ['command', scriptCommand],
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
    }
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

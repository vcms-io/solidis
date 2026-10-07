/** Commands that cannot run against a shared server, and replies only older or other servers send. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aclDeluser } from '../../../sources/command/acl.deluser.ts';
import { aclGetuser } from '../../../sources/command/acl.getuser.ts';
import { aclLog } from '../../../sources/command/acl.log.ts';
import { aclSetuser } from '../../../sources/command/acl.setuser.ts';
import { createCommand as createAppendCommand } from '../../../sources/command/append.ts';
import { createCommand as createAuthCommand } from '../../../sources/command/auth.ts';
import { bfInfo } from '../../../sources/command/bf.info.ts';
import {
  bfInsert,
  createCommand as createBloomInsertCommand,
} from '../../../sources/command/bf.insert.ts';
import { createCommand as createBloomLoadchunkCommand } from '../../../sources/command/bf.loadchunk.ts';
import { bfReserve } from '../../../sources/command/bf.reserve.ts';
import {
  bgsave,
  createCommand as createBgsaveCommand,
} from '../../../sources/command/bgsave.ts';
import { createCommand as createBitcountCommand } from '../../../sources/command/bitcount.ts';
import { cfInfo } from '../../../sources/command/cf.info.ts';
import {
  cfInsert,
  createCommand as createCuckooInsertCommand,
} from '../../../sources/command/cf.insert.ts';
import { cfInsertnx } from '../../../sources/command/cf.insertnx.ts';
import { createCommand as createCuckooLoadchunkCommand } from '../../../sources/command/cf.loadchunk.ts';
import { cfReserve } from '../../../sources/command/cf.reserve.ts';
import {
  clientList,
  createCommand as createClientListCommand,
} from '../../../sources/command/client.list.ts';
import {
  clientPause,
  createCommand as createClientPauseCommand,
} from '../../../sources/command/client.pause.ts';
import { createCommand as createClientTrackingCommand } from '../../../sources/command/client.tracking.ts';
import { createCommand as createClientUnblockCommand } from '../../../sources/command/client.unblock.ts';
import {
  commandDocs,
  createCommand as createCommandDocsCommand,
} from '../../../sources/command/command.docs.ts';
import { debug } from '../../../sources/command/debug.ts';
import {
  createCommand as createDelexCommand,
  delex,
} from '../../../sources/command/delex.ts';
import { dump } from '../../../sources/command/dump.ts';
import { evalRo } from '../../../sources/command/eval.ro.ts';
import { evaluate } from '../../../sources/command/eval.ts';
import { evalshaRo } from '../../../sources/command/evalsha.ro.ts';
import { evalsha } from '../../../sources/command/evalsha.ts';
import { failover } from '../../../sources/command/failover.ts';
import { fcallRo } from '../../../sources/command/fcall.ro.ts';
import { fcall } from '../../../sources/command/fcall.ts';
import {
  createCommand as createFunctionFlushCommand,
  functionFlush,
} from '../../../sources/command/function.flush.ts';
import { functionList } from '../../../sources/command/function.list.ts';
import { functionStats } from '../../../sources/command/function.stats.ts';
import { georadiusRo } from '../../../sources/command/georadius.ro.ts';
import { georadiusbymemberRo } from '../../../sources/command/georadiusbymember.ro.ts';
import { geosearch } from '../../../sources/command/geosearch.ts';
import { get } from '../../../sources/command/get.ts';
import { createCommand as createGetsetCommand } from '../../../sources/command/getset.ts';
import { hdel } from '../../../sources/command/hdel.ts';
import {
  createCommand as createHelloCommand,
  hello,
} from '../../../sources/command/hello.ts';
import { createCommand as createHashExpireCommand } from '../../../sources/command/hexpire.ts';
import { hmget } from '../../../sources/command/hmget.ts';
import { createCommand as createHmsetCommand } from '../../../sources/command/hmset.ts';
import { createCommand as createHrandfieldCommand } from '../../../sources/command/hrandfield.ts';
import {
  createCommand as createHsetCommand,
  hset,
} from '../../../sources/command/hset.ts';
import { createCommand as createHsetnxCommand } from '../../../sources/command/hsetnx.ts';
import { incr } from '../../../sources/command/incr.ts';
import {
  createCommand as createInfoCommand,
  info,
} from '../../../sources/command/info.ts';
import { jsonArrappend } from '../../../sources/command/json.arrappend.ts';
import { jsonArrinsert } from '../../../sources/command/json.arrinsert.ts';
import {
  createCommand as createJsonArrpopCommand,
  jsonArrpop,
} from '../../../sources/command/json.arrpop.ts';
import { createCommand as createJsonGetCommand } from '../../../sources/command/json.get.ts';
import {
  createCommand as createJsonMergeCommand,
  jsonMerge,
} from '../../../sources/command/json.merge.ts';
import { jsonResp } from '../../../sources/command/json.resp.ts';
import { latencyHistogram } from '../../../sources/command/latency.histogram.ts';
import { latencyLatest } from '../../../sources/command/latency.latest.ts';
import {
  createCommand as createLatencyResetCommand,
  latencyReset,
} from '../../../sources/command/latency.reset.ts';
import { lcs } from '../../../sources/command/lcs.ts';
import { createCommand as createLinsertCommand } from '../../../sources/command/linsert.ts';
import { lolwut } from '../../../sources/command/lolwut.ts';
import {
  createCommand as createLposCommand,
  lpos,
} from '../../../sources/command/lpos.ts';
import {
  createCommand as createLpushCommand,
  lpush,
} from '../../../sources/command/lpush.ts';
import { createCommand as createLpushxCommand } from '../../../sources/command/lpushx.ts';
import { lrange } from '../../../sources/command/lrange.ts';
import { createCommand as createLremCommand } from '../../../sources/command/lrem.ts';
import { createCommand as createLsetCommand } from '../../../sources/command/lset.ts';
import { memoryStats } from '../../../sources/command/memory.stats.ts';
import { memoryUsage } from '../../../sources/command/memory.usage.ts';
import { mget } from '../../../sources/command/mget.ts';
import {
  createCommand as createMigrateCommand,
  migrate,
} from '../../../sources/command/migrate.ts';
import { moduleList } from '../../../sources/command/module.list.ts';
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
import { multi } from '../../../sources/command/multi.ts';
import { createCommand as createPsetexCommand } from '../../../sources/command/psetex.ts';
import { psubscribe } from '../../../sources/command/psubscribe.ts';
import { createCommand as createPublishCommand } from '../../../sources/command/publish.ts';
import { pubsubChannels } from '../../../sources/command/pubsub.channels.ts';
import { createCommand as createPubsubNumsubCommand } from '../../../sources/command/pubsub.numsub.ts';
import { pubsubShardchannels } from '../../../sources/command/pubsub.shardchannels.ts';
import { createCommand as createPubsubShardnumsubCommand } from '../../../sources/command/pubsub.shardnumsub.ts';
import { punsubscribe } from '../../../sources/command/punsubscribe.ts';
import { replconf } from '../../../sources/command/replconf.ts';
import { replicaof } from '../../../sources/command/replicaof.ts';
import { createCommand as createRestoreCommand } from '../../../sources/command/restore.ts';
import {
  createCommand as createRpushCommand,
  rpush,
} from '../../../sources/command/rpush.ts';
import { createCommand as createRpushxCommand } from '../../../sources/command/rpushx.ts';
import { sadd } from '../../../sources/command/sadd.ts';
import { scan } from '../../../sources/command/scan.ts';
import {
  createCommand as createScriptFlushCommand,
  scriptFlush,
} from '../../../sources/command/script.flush.ts';
import { sdiff } from '../../../sources/command/sdiff.ts';
import {
  createCommand as createSetCommand,
  set,
} from '../../../sources/command/set.ts';
import { createCommand as createSetexCommand } from '../../../sources/command/setex.ts';
import { createCommand as createSetnxCommand } from '../../../sources/command/setnx.ts';
import { createCommand as createSetrangeCommand } from '../../../sources/command/setrange.ts';
import { shutdown } from '../../../sources/command/shutdown.ts';
import { sinter } from '../../../sources/command/sinter.ts';
import { slowlogGet } from '../../../sources/command/slowlog.get.ts';
import { createCommand as createSmismemberCommand } from '../../../sources/command/smismember.ts';
import { sort } from '../../../sources/command/sort.ts';
import { createCommand as createSpublishCommand } from '../../../sources/command/spublish.ts';
import { srem } from '../../../sources/command/srem.ts';
import { ssubscribe } from '../../../sources/command/ssubscribe.ts';
import { subscribe } from '../../../sources/command/subscribe.ts';
import { sunion } from '../../../sources/command/sunion.ts';
import { sunsubscribe } from '../../../sources/command/sunsubscribe.ts';
import { createCommand as createTimeSeriesCreateCommand } from '../../../sources/command/ts.create.ts';
import {
  createCommand as createTimeSeriesGetCommand,
  tsGet,
} from '../../../sources/command/ts.get.ts';
import { createCommand as createTimeSeriesMgetCommand } from '../../../sources/command/ts.mget.ts';
import { createCommand as createTimeSeriesMrangeCommand } from '../../../sources/command/ts.mrange.ts';
import { createCommand as createTimeSeriesMrevrangeCommand } from '../../../sources/command/ts.mrevrange.ts';
import { createCommand as createTimeSeriesRangeCommand } from '../../../sources/command/ts.range.ts';
import { createCommand as createTimeSeriesRevrangeCommand } from '../../../sources/command/ts.revrange.ts';
import { unsubscribe } from '../../../sources/command/unsubscribe.ts';
import {
  tryReplyToInteger,
  tryReplyToNumber,
} from '../../../sources/command/utils/reply.ts';
import { wait } from '../../../sources/command/wait.ts';
import { watch } from '../../../sources/command/watch.ts';
import { createCommand as createXaddCommand } from '../../../sources/command/xadd.ts';
import { xautoclaim } from '../../../sources/command/xautoclaim.ts';
import {
  createCommand as createXclaimCommand,
  xclaim,
} from '../../../sources/command/xclaim.ts';
import { xdel } from '../../../sources/command/xdel.ts';
import { xinfoConsumers } from '../../../sources/command/xinfo.consumers.ts';
import { xinfoGroups } from '../../../sources/command/xinfo.groups.ts';
import { xinfoStream } from '../../../sources/command/xinfo.stream.ts';
import { createCommand as createXpendingCommand } from '../../../sources/command/xpending.ts';
import {
  createCommand as createXreadCommand,
  xread,
} from '../../../sources/command/xread.ts';
import {
  createCommand as createXreadgroupCommand,
  xreadgroup,
} from '../../../sources/command/xreadgroup.ts';
import { createCommand as createZinterCommand } from '../../../sources/command/zinter.ts';
import { createCommand as createZrandmemberCommand } from '../../../sources/command/zrandmember.ts';
import { zrange } from '../../../sources/command/zrange.ts';
import { zrem } from '../../../sources/command/zrem.ts';
import {
  RespError,
  SolidisConnectionError,
  SolidisProtocols,
  SolidisRequesterError,
} from '../../../sources/index.ts';

import type {
  SolidisData,
  SolidisSendOptions,
  StringOrBuffer,
} from '../../../sources/index.ts';

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
  it('gives MIGRATE and SHUTDOWN the deadline their waits need', async () => {
    const deadlines: (SolidisSendOptions | undefined)[] = [];
    const sender = {
      send: async (_: StringOrBuffer[][], options?: SolidisSendOptions) => {
        deadlines.push(options);

        return [['OK']];
      },
    };

    await migrate.call(sender, '10.0.0.2', 6380, 'key', 0, 20_000);
    await migrate.call(sender, '10.0.0.2', 6380, 'key', 0, 0);
    await migrate.call(sender, '10.0.0.2', 6380, 'key', 0, -5);
    await shutdown.call(sender);
    await shutdown.call(sender, { abort: true });

    assert.deepStrictEqual(deadlines, [
      { blockingTimeout: 20_000 },
      { blockingTimeout: 1000 },
      { blockingTimeout: 1000 },
      { blockingTimeout: 0 },
      { blockingTimeout: undefined },
    ]);
  });

  it('rejects an error reply to every method that resolved one in 0.4.x', async () => {
    const refusal = new RespError(
      'NOPERM this user has no permissions to access one of the channels used as arguments',
    );
    const calls: [
      string,
      (client: ReturnType<typeof createRecorder>) => Promise<unknown>,
    ][] = [
      ['EVAL', (client) => evaluate.call(client, 'return 1', [], [])],
      ['EVAL_RO', (client) => evalRo.call(client, 'return 1', [], [])],
      ['EVALSHA', (client) => evalsha.call(client, 'sha', [], [])],
      ['EVALSHA_RO', (client) => evalshaRo.call(client, 'sha', [], [])],
      ['FCALL', (client) => fcall.call(client, 'name', [], [])],
      ['FCALL_RO', (client) => fcallRo.call(client, 'name', [], [])],
      ['DEBUG OBJECT', (client) => debug.call(client, 'OBJECT', 'key')],
      ['JSON.RESP', (client) => jsonResp.call(client, 'key')],
      ['ACL LOG', (client) => aclLog.call(client, 'RESET')],
      ['SUBSCRIBE', (client) => subscribe.call(client, 'news')],
      ['PSUBSCRIBE', (client) => psubscribe.call(client, 'news.*')],
      ['SSUBSCRIBE', (client) => ssubscribe.call(client, 'news')],
      ['UNSUBSCRIBE', (client) => unsubscribe.call(client, 'news')],
      ['PUNSUBSCRIBE', (client) => punsubscribe.call(client, 'news.*')],
      ['SUNSUBSCRIBE', (client) => sunsubscribe.call(client, 'news')],
    ];

    for (const [name, call] of calls) {
      await assert.rejects(call(createRecorder(refusal)), {
        name: 'SolidisCommandError',
        message: `[${name}] ${refusal.message}`,
        cause: refusal,
      });
    }
  });

  it('reads a HELLO reply without a role, as a Sentinel sends it, as a null role', async () => {
    const fields: [string, SolidisData][] = [
      ['server', bulk('redis')],
      ['version', bulk('8.2.0')],
      ['proto', 3],
      ['id', 7],
      ['mode', bulk('sentinel')],
      ['modules', []],
    ];

    for (const reply of [new Map(fields), fields.flat()]) {
      const info = await hello.call(createRecorder(reply));

      assert.strictEqual(info.role, null);
      assert.strictEqual(info.mode, 'sentinel');
    }

    const master = await hello.call(
      createRecorder(new Map([...fields, ['role', bulk('master')]])),
    );

    assert.strictEqual(master.role, 'master');
  });

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

  it('sends variadic commands with as many items as the caller can spread', async () => {
    const items = Array.from({ length: 80_000 }, (_, index) => `${index}`);
    const calls: [string, (sender: object) => Promise<unknown>][] = [
      ['SADD', (sender) => sadd.call(sender, 'key', ...items)],
      ['SREM', (sender) => srem.call(sender, 'key', ...items)],
      ['ZREM', (sender) => zrem.call(sender, 'key', ...items)],
      ['LPUSH', (sender) => lpush.call(sender, 'key', ...items)],
      ['RPUSH', (sender) => rpush.call(sender, 'key', ...items)],
      ['HDEL', (sender) => hdel.call(sender, 'key', ...items)],
      ['HMGET', (sender) => hmget.call(sender, 'key', ...items)],
      ['MGET', (sender) => mget.call(sender, ...items)],
      ['XDEL', (sender) => xdel.call(sender, 'key', ...items)],
      ['SINTER', (sender) => sinter.call(sender, ...items)],
      ['SUNION', (sender) => sunion.call(sender, ...items)],
      ['SDIFF', (sender) => sdiff.call(sender, ...items)],
      ['WATCH', (sender) => watch.call(sender, ...items)],
      [
        'JSON.ARRAPPEND',
        (sender) => jsonArrappend.call(sender, 'key', '$', ...items),
      ],
      [
        'JSON.ARRINSERT',
        (sender) => jsonArrinsert.call(sender, 'key', '$', 0, ...items),
      ],
      ['ACL', (sender) => aclDeluser.call(sender, ...items)],
      ['ACL', (sender) => aclSetuser.call(sender, 'user', ...items)],
      ['LATENCY', (sender) => latencyHistogram.call(sender, ...items)],
      ['LOLWUT', (sender) => lolwut.call(sender, 5, ...items)],
      ['DEBUG', (sender) => debug.call(sender, 'SLEEP', ...items)],
      ['REPLCONF', (sender) => replconf.call(sender, 'CAPA', ...items)],
    ];

    for (const [name, call] of calls) {
      const recorder = createRecorder(null);

      await call(recorder).catch(() => {});

      const [command] = recorder.commands;

      assert.strictEqual(command?.[0], name);
      assert.strictEqual(command.at(-1), '79999');
    }

    const recorder = createRecorder([]);
    const client: {
      send: typeof recorder.send;
      sadd: typeof sadd;
      multi: typeof multi;
    } = Object.assign(Object.create(recorder), { sadd, multi });
    const transaction = client.multi();

    transaction.sadd('key', ...items.slice(0, 50_000));
    await transaction.exec().catch(() => {});

    assert.strictEqual(recorder.commands[1]?.length, 50_002);
  });

  it('leaves no send property of its own on a client a transaction used', () => {
    const recorder = createRecorder(null);
    const client: {
      send: typeof recorder.send;
      sadd: typeof sadd;
      multi: typeof multi;
    } = Object.assign(Object.create(recorder), { sadd, multi });

    client.multi().sadd('key', 'member');

    assert.strictEqual(Object.hasOwn(client, 'send'), false);
    assert.strictEqual(client.send, recorder.send);

    const send = createRecorder(null).send;

    client.send = send;
    client.multi().sadd('key', 'member');

    assert.strictEqual(Object.hasOwn(client, 'send'), true);
    assert.strictEqual(client.send, send);
  });

  it('restores the send of the client when a queued call overflows the stack', () => {
    const recorder = createRecorder(null);
    const client: {
      send: typeof recorder.send;
      sadd: typeof sadd;
      multi: typeof multi;
    } = Object.assign(Object.create(recorder), { sadd, multi });
    const pool = Array.from({ length: 150_000 }, (_, index) => `${index}`);
    const queue = (count: number, depth: number): boolean => {
      if (depth > 0) {
        return queue(count, depth - 1);
      }

      try {
        client.multi().sadd('key', ...pool.slice(0, count));

        return true;
      } catch {
        return false;
      }
    };

    for (const depth of [1, 2, 5]) {
      let low = 50_000;
      let high = pool.length;

      while (low < high) {
        const middle = Math.ceil((low + high) / 2);

        if (queue(middle, depth)) {
          low = middle;
        } else {
          high = middle - 1;
        }
      }

      for (let count = low - 10; count < low + 40; count += 1) {
        queue(count, depth);

        assert.strictEqual(Object.hasOwn(client, 'send'), false, `${count}`);
        assert.strictEqual(client.send, recorder.send);
      }
    }
  });

  it('keeps server field names such as __proto__ and constructor as data', async () => {
    const fields = await info.call(
      createRecorder(bulk('__proto__:x\r\nconstructor:y\r\n')),
    );

    assert.deepStrictEqual(Object.keys(fields), ['__proto__', 'constructor']);
    assert.strictEqual(
      Object.getOwnPropertyDescriptor(fields, '__proto__')?.value,
      'x',
    );
    assert.strictEqual(Object.getPrototypeOf(fields), Object.prototype);

    const histogram = await latencyHistogram.call(
      createRecorder(
        new Map([
          [
            '__proto__',
            new Map<string, SolidisData>([
              ['calls', 2],
              ['histogram_usec', new Map([['8', 2]])],
            ]),
          ],
        ]),
      ),
    );

    assert.deepStrictEqual(
      Object.getOwnPropertyDescriptor(histogram, '__proto__')?.value,
      { calls: 2, histogramUsec: { 8: 2 } },
    );
    assert.strictEqual(Object.getPrototypeOf(histogram), Object.prototype);
    assert.deepStrictEqual(
      await bfInfo.call(
        createRecorder(
          new Map<string, SolidisData>([
            ['Capacity', 5],
            ['constructor', 7],
            ['__proto__', 9],
          ]),
        ),
        'key',
      ),
      {
        capacity: 5,
        size: 0,
        numberOfFilters: 0,
        numberOfItemsInserted: 0,
        expansionRate: 0,
      },
    );
    assert.deepStrictEqual(
      await cfInfo.call(
        createRecorder([bulk('Size'), 5, bulk('toString'), 7]),
        'key',
      ),
      {
        size: 5,
        numberOfBuckets: 0,
        numberOfFilter: 0,
        numberOfItemsInserted: 0,
        numberOfItemsDeleted: 0,
        bucketSize: 0,
        expansionRate: 0,
        maxIteration: 0,
      },
    );
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

    const aborting = { abort: false };
    const shut = shutdown.call(
      {
        send: async () => {
          throw new SolidisConnectionError('Connection closed.');
        },
      },
      aborting,
    );

    aborting.abort = true;

    const items = ['a', 'b', 'c'];
    const full = new RespError('ERR non scaling filter is full');
    const inserted = bfInsert.call(createRecorder([1, full]), 'bf', items);

    items.length = 0;

    assert.deepStrictEqual(await ranged, [{ member: 'a', score: 1 }]);
    assert.deepStrictEqual(await read, bulk('v'));
    assert.strictEqual(await replaced, 'old');
    assert.deepStrictEqual(await inserted, [1, full, full]);
    assert.strictEqual(await shut, 'OK');
  });

  it('reads options through getters and prototypes, as the command it builds does', async () => {
    class Scored {
      get withScores() {
        return true as const;
      }
    }

    class Previous {
      get returnOldValue() {
        return true as const;
      }
    }

    class Binary {
      get buffer() {
        return true as const;
      }
    }

    class Exact {
      get bigint() {
        return true as const;
      }
    }

    class Matching {
      get match() {
        return 'user:*';
      }
    }

    const ranged = createRecorder([bulk('a'), bulk('1')]);
    const scanned = createRecorder([bulk('0'), [bulk('user:1')]]);
    const pages: string[][] = [];

    assert.deepStrictEqual(
      await zrange.call(ranged, 'z', '0', '-1', new Scored()),
      [{ member: 'a', score: 1 }],
    );
    assert.deepStrictEqual(ranged.commands, [
      ['ZRANGE', 'z', '0', '-1', 'WITHSCORES'],
    ]);
    assert.strictEqual(
      await set.call(createRecorder(bulk('old')), 'k', 'v', new Previous()),
      'old',
    );
    assert.deepStrictEqual(
      await get.call(createRecorder(bulk('v')), 'k', new Binary()),
      bulk('v'),
    );
    assert.strictEqual(
      await incr.call(createRecorder(5), 'k', new Exact()),
      5n,
    );
    assert.strictEqual(
      await sort.call(createRecorder(3), 'k', Object.create({ store: 'dest' })),
      3,
    );
    assert.deepStrictEqual(
      await xclaim.call(
        createRecorder([bulk('1-1')]),
        's',
        'g',
        'c',
        0,
        ['1-1'],
        Object.create({ justid: true }),
      ),
      ['1-1'],
    );
    assert.deepStrictEqual(
      await lcs.call(
        createRecorder(
          new Map<string, SolidisData>([
            ['matches', [[[0, 1], [2, 3], 2]]],
            ['len', 2],
          ]),
        ),
        'a',
        'b',
        Object.create({ idx: true, withmatchlen: true }),
      ),
      { matches: [{ a: [0, 1], b: [2, 3], length: 2 }], length: 2 },
    );
    assert.deepStrictEqual(
      await geosearch.call(
        createRecorder([[bulk('m'), bulk('1.5')]]),
        'g',
        { frommember: 'x' },
        { byradius: { radius: 1, unit: 'KM' } },
        Object.create({ withDist: true }),
      ),
      [{ member: 'm', distance: 1.5 }],
    );
    assert.deepStrictEqual(
      await functionList.call(
        createRecorder([
          [
            bulk('library_name'),
            bulk('lib'),
            bulk('engine'),
            bulk('LUA'),
            bulk('functions'),
            [],
            bulk('library_code'),
            bulk('code'),
          ],
        ]),
        Object.create({ withCode: true }),
      ),
      [{ libraryName: 'lib', engine: 'LUA', functions: [], code: 'code' }],
    );
    assert.deepStrictEqual(
      await functionList.call(
        createRecorder([
          [
            bulk('library_name'),
            bulk('lib'),
            bulk('engine'),
            bulk('LUA'),
            bulk('functions'),
            [],
            bulk('library_code'),
            bulk('code'),
          ],
        ]),
        JSON.parse('{"withCode":1}'),
      ),
      [{ libraryName: 'lib', engine: 'LUA', functions: [], code: 'code' }],
    );

    for await (const keys of scan.call(scanned, new Matching())) {
      pages.push(keys);
    }

    assert.deepStrictEqual(pages, [['user:1']]);
    assert.deepStrictEqual(scanned.commands, [
      ['SCAN', '0', 'MATCH', 'user:*'],
    ]);
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
      createSetCommand('k', value),
      createSetCommand('k', 'v', { setIfValueEquals: value }),
      createSetCommand('k', 'v', { setIfValueNotEquals: value }),
      createSetnxCommand('k', value),
      createSetexCommand('k', 1, value),
      createPsetexCommand('k', 1, value),
      createGetsetCommand('k', value),
      createSetrangeCommand('k', 0, value),
      createAppendCommand('k', value),
      createMsetCommand({ k: value }),
      createMsetnxCommand({ k: value }),
      createHsetCommand('k', 'f', value),
      createHsetCommand('k', { f: value }),
      createHmsetCommand('k', { f: value }),
      createHsetnxCommand('k', 'f', value),
      createLpushCommand('k', value),
      createRpushCommand('k', value),
      createLpushxCommand('k', [value]),
      createRpushxCommand('k', [value]),
      createLsetCommand('k', 0, value),
      createLinsertCommand('k', 'BEFORE', 'pivot', value),
      createLremCommand('k', 0, value),
      createLposCommand('k', value),
      createSmismemberCommand('k', [value]),
      createDelexCommand('k', { ifValueEquals: value }),
      createDelexCommand('k', { ifValueNotEquals: value }),
      createRestoreCommand('k', 0, value),
      createBloomLoadchunkCommand('k', 1, value),
      createCuckooLoadchunkCommand('k', 1, value),
      createAuthCommand('user', value),
      createHelloCommand(SolidisProtocols.RESP3, 'user', value),
      createPublishCommand('c', value),
      createSpublishCommand('c', value),
      createXaddCommand('k', '*', { f: value }),
    ];

    for (const command of commands) {
      assert.strictEqual(command.at(-1), value, `${command[0]}`);
    }

    assert.strictEqual(
      createLinsertCommand('k', 'AFTER', value, 'element')[3],
      value,
    );
    assert.strictEqual(createAuthCommand(value, 'password')[1], value);
    assert.strictEqual(
      createHelloCommand(SolidisProtocols.RESP3, value, 'password')[3],
      value,
    );
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
      [
        [
          [0, 1],
          [2, 3],
        ],
      ],
      [[[0, 1], [2, 3], bulk('2')]],
    ]) {
      await assert.rejects(
        lcs.call(reply(matches), 'a', 'b', { idx: true, withmatchlen: true }),
        {
          name: 'SolidisCommandError',
          message: /^\[LCS\] Unexpected reply: /,
        },
      );
    }

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

  it('builds the optional parts of each command exactly as given', () => {
    const cases: [StringOrBuffer[], StringOrBuffer[]][] = [
      [createFunctionFlushCommand(), ['FUNCTION', 'FLUSH']],
      [createFunctionFlushCommand(true), ['FUNCTION', 'FLUSH', 'ASYNC']],
      [createFunctionFlushCommand(false), ['FUNCTION', 'FLUSH', 'SYNC']],
      [
        createBloomInsertCommand('key', ['a'], {
          expansion: 2,
          nonScaling: true,
        }),
        ['BF.INSERT', 'key', 'EXPANSION', '2', 'NONSCALING', 'ITEMS', 'a'],
      ],
      [
        createBloomInsertCommand('key', ['a'], { error: 0.01 }),
        ['BF.INSERT', 'key', 'ERROR', '0.01', 'ITEMS', 'a'],
      ],
      [
        createBitcountCommand('key', { mode: 'BIT' }),
        ['BITCOUNT', 'key', '0', '-1', 'BIT'],
      ],
      [createBitcountCommand('key', { end: 5 }), ['BITCOUNT', 'key', '0', '5']],
      [
        createJsonArrpopCommand('key', '$.items', -1),
        ['JSON.ARRPOP', 'key', '$.items', '-1'],
      ],
      [
        createJsonArrpopCommand('key', undefined, 0),
        ['JSON.ARRPOP', 'key', '.', '0'],
      ],
      [createJsonArrpopCommand('key', ''), ['JSON.ARRPOP', 'key', '']],
      [
        createXpendingCommand('key', 'group', '-', '+', 5),
        ['XPENDING', 'key', 'group', '-', '+', '5'],
      ],
      [
        createXpendingCommand('key', 'group', '-', '+', 5, 'reader', 1000),
        ['XPENDING', 'key', 'group', 'IDLE', '1000', '-', '+', '5', 'reader'],
      ],
      [createXpendingCommand('key', 'group'), ['XPENDING', 'key', 'group']],
      [createHrandfieldCommand('key', 0), ['HRANDFIELD', 'key', '0']],
      [createZrandmemberCommand('key', 0), ['ZRANDMEMBER', 'key', '0']],
      [createBgsaveCommand(true), ['BGSAVE', 'SCHEDULE']],
      [
        createClientListCommand({ type: 'PUBSUB' }),
        ['CLIENT', 'LIST', 'TYPE', 'PUBSUB'],
      ],
      [
        createClientPauseCommand(100, { mode: 'WRITE' }),
        ['CLIENT', 'PAUSE', '100', 'WRITE'],
      ],
      [
        createClientUnblockCommand(7, { timeout: true }),
        ['CLIENT', 'UNBLOCK', '7', 'TIMEOUT'],
      ],
      [createInfoCommand('persistence'), ['INFO', 'persistence']],
      [createScriptFlushCommand({ sync: true }), ['SCRIPT', 'FLUSH', 'SYNC']],
      [createScriptFlushCommand({ async: true }), ['SCRIPT', 'FLUSH', 'ASYNC']],
      [createTimeSeriesGetCommand('key', true), ['TS.GET', 'key', 'LATEST']],
      [
        createTimeSeriesMgetCommand({ area: 'east' }, { latest: true }),
        ['TS.MGET', 'LATEST', 'FILTER', 'area=east'],
      ],
      [
        createXclaimCommand('key', 'group', 'consumer', 0, ['0-1'], {
          force: true,
        }),
        ['XCLAIM', 'key', 'group', 'consumer', '0', '0-1', 'FORCE'],
      ],
    ];

    for (const [command, expected] of cases) {
      assert.deepStrictEqual(command, expected);
    }
  });

  it('passes each flush mode on to the command it sends', async () => {
    const recorder = createRecorder('OK');

    await functionFlush.call(recorder);
    await functionFlush.call(recorder, true);
    await functionFlush.call(recorder, false);
    await scriptFlush.call(recorder);
    await scriptFlush.call(recorder, { sync: true });
    await scriptFlush.call(recorder, { async: true });

    assert.deepStrictEqual(recorder.commands, [
      ['FUNCTION', 'FLUSH'],
      ['FUNCTION', 'FLUSH', 'ASYNC'],
      ['FUNCTION', 'FLUSH', 'SYNC'],
      ['SCRIPT', 'FLUSH'],
      ['SCRIPT', 'FLUSH', 'SYNC'],
      ['SCRIPT', 'FLUSH', 'ASYNC'],
    ]);
  });

  it('passes every argument of a method on to the command it sends', async () => {
    const recorder = createRecorder(null);
    const calls: [() => Promise<unknown>, StringOrBuffer[]][] = [
      [
        () => bfReserve.call(recorder, 'k', 0.01, 100, 2),
        ['BF.RESERVE', 'k', '0.01', '100', 'EXPANSION', '2'],
      ],
      [() => bgsave.call(recorder, true), ['BGSAVE', 'SCHEDULE']],
      [
        () => cfInsert.call(recorder, 'k', ['a'], { capacity: 10 }),
        ['CF.INSERT', 'k', 'CAPACITY', '10', 'ITEMS', 'a'],
      ],
      [
        () => cfInsertnx.call(recorder, 'k', ['a'], { nocreate: true }),
        ['CF.INSERTNX', 'k', 'NOCREATE', 'ITEMS', 'a'],
      ],
      [
        () => cfReserve.call(recorder, 'k', 100, 4, 20, 2),
        [
          'CF.RESERVE',
          'k',
          '100',
          'BUCKETSIZE',
          '4',
          'MAXITERATIONS',
          '20',
          'EXPANSION',
          '2',
        ],
      ],
      [
        () => clientList.call(recorder, { type: 'NORMAL' }),
        ['CLIENT', 'LIST', 'TYPE', 'NORMAL'],
      ],
      [
        () => clientPause.call(recorder, 100, { mode: 'WRITE' }),
        ['CLIENT', 'PAUSE', '100', 'WRITE'],
      ],
      [() => commandDocs.call(recorder, ['get']), ['COMMAND', 'DOCS', 'get']],
      [
        () =>
          georadiusRo.call(recorder, 'g', 1, 2, 3, 'KM', { withDist: true }),
        ['GEORADIUS_RO', 'g', '1', '2', '3', 'km', 'WITHDIST'],
      ],
      [
        () =>
          georadiusbymemberRo.call(recorder, 'g', 'm', 3, 'KM', {
            withHash: true,
          }),
        ['GEORADIUSBYMEMBER_RO', 'g', 'm', '3', 'km', 'WITHHASH'],
      ],
      [() => info.call(recorder, 'server'), ['INFO', 'server']],
      [
        () => jsonArrpop.call(recorder, 'k', '$.a', 1),
        ['JSON.ARRPOP', 'k', '$.a', '1'],
      ],
      [
        () => jsonMerge.call(recorder, 'k', '{}', '$.a'),
        ['JSON.MERGE', 'k', '$.a', '{}'],
      ],
      [() => jsonResp.call(recorder, 'k', '$.a'), ['JSON.RESP', 'k', '$.a']],
      [
        () => latencyReset.call(recorder, ['command']),
        ['LATENCY', 'RESET', 'command'],
      ],
      [
        () => lolwut.call(recorder, 5, '1', '2'),
        ['LOLWUT', 'VERSION', '5', '1', '2'],
      ],
      [
        () => memoryUsage.call(recorder, 'k', 5),
        ['MEMORY', 'USAGE', 'k', 'SAMPLES', '5'],
      ],
      [
        () => pubsubChannels.call(recorder, 'news.*'),
        ['PUBSUB', 'CHANNELS', 'news.*'],
      ],
      [
        () => pubsubShardchannels.call(recorder, 'news.*'),
        ['PUBSUB', 'SHARDCHANNELS', 'news.*'],
      ],
      [() => slowlogGet.call(recorder, 5), ['SLOWLOG', 'GET', '5']],
      [() => tsGet.call(recorder, 'k', true), ['TS.GET', 'k', 'LATEST']],
      [() => wait.call(recorder, 1, 100), ['WAIT', '1', '100']],
      [
        () => xread.call(recorder, ['s'], ['0'], 10, 100),
        ['XREAD', 'COUNT', '10', 'BLOCK', '100', 'STREAMS', 's', '0'],
      ],
      [
        () => xreadgroup.call(recorder, 'g', 'c', ['s'], ['>'], 10, 100, true),
        [
          'XREADGROUP',
          'GROUP',
          'g',
          'c',
          'COUNT',
          '10',
          'BLOCK',
          '100',
          'NOACK',
          'STREAMS',
          's',
          '>',
        ],
      ],
    ];

    for (const [call, expected] of calls) {
      recorder.commands.length = 0;
      await call().catch(() => undefined);
      assert.deepStrictEqual(recorder.commands, [expected]);
    }
  });

  it('rejects a null among the positions LPOS returns', async () => {
    await assert.rejects(
      lpos.call(createRecorder([1, null]), 'list', 'a', { count: 2 }),
      {
        name: 'SolidisCommandError',
        message: '[LPOS] Unexpected reply: null',
      },
    );
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

  it('rejects a reply to ACL LOG RESET other than OK', async () => {
    assert.deepStrictEqual(
      await aclLog.call(createRecorder('OK'), 'RESET'),
      [],
    );
    await assert.rejects(aclLog.call(createRecorder(1), 'RESET'), {
      name: 'SolidisCommandError',
      message: '[ACL LOG] Unexpected reply: number',
    });
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
              [
                'command',
                [bulk('FCALL'), bulk('slow'), bulk('0'), bulk('a b')],
              ],
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
        command: ['FCALL', 'slow', '0', 'a b'],
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

  it('sets only the COMMAND DOCS fields the reply has', async () => {
    const docs = await commandDocs.call(
      createRecorder([
        bulk('get'),
        [
          bulk('summary'),
          bulk(''),
          bulk('arguments'),
          [[bulk('name'), bulk('key'), bulk('type'), bulk('key')]],
        ],
      ]),
    );

    assert.deepStrictEqual(Object.keys(docs.get), ['summary', 'arguments']);
    assert.strictEqual(docs.get.summary, '');
    assert.deepStrictEqual(docs.get.arguments, [
      { name: 'key', type: 'key', optional: false, multiple: false },
    ]);
    await assert.rejects(
      commandDocs.call(
        createRecorder([bulk('get'), [bulk('arguments'), bulk('none')]]),
      ),
      { message: '[COMMAND DOCS] Unexpected reply: Buffer(4)' },
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
              [
                bulk('deprecated'),
                bulk('nondeterministic_output'),
                bulk('syscmd'),
              ],
            ],
          ],
        ],
      ]),
    );

    assert.deepStrictEqual(docs.client.subcommands?.['client|kill'].docFlags, [
      'deprecated',
      'syscmd',
    ]);

    const resp3 = await commandDocs.call(
      createRecorder(
        new Map<string, SolidisData>([
          [
            'replconf',
            new Map<string, SolidisData>([
              ['doc_flags', new Set([bulk('syscmd')])],
            ]),
          ],
        ]),
      ),
    );

    assert.deepStrictEqual(resp3.replconf.docFlags, ['syscmd']);
    assert.strictEqual(
      docs.client.subcommands?.['client|kill'].summary,
      'Terminates connections',
    );
  });

  it('keeps a zero or NaN a server reports apart from a field it leaves out', async () => {
    const info = await hello.call(
      createRecorder([
        bulk('server'),
        bulk('redis'),
        bulk('version'),
        bulk('8.2.0'),
        bulk('proto'),
        3,
        bulk('id'),
        0,
        bulk('mode'),
        bulk('standalone'),
        bulk('modules'),
        [],
      ]),
    );

    assert.strictEqual(info.id, 0);
    assert.ok(
      Number.isNaN(
        (
          await memoryStats.call(
            createRecorder([bulk('fragmentation'), Number.NaN]),
          )
        ).fragmentation,
      ),
    );
    assert.deepStrictEqual(
      await xinfoGroups.call(
        createRecorder([
          [
            bulk('name'),
            bulk('g'),
            bulk('consumers'),
            0,
            bulk('pending'),
            0,
            bulk('last-delivered-id'),
            bulk('0-0'),
            bulk('entries-read'),
            0,
            bulk('lag'),
            0,
          ],
        ]),
        'stream',
      ),
      [
        {
          name: 'g',
          consumers: 0,
          pending: 0,
          lastDeliveredId: '0-0',
          entriesRead: 0,
          lag: 0,
        },
      ],
    );
    assert.deepStrictEqual(
      await xinfoConsumers.call(
        createRecorder([
          [
            bulk('name'),
            bulk('c'),
            bulk('pending'),
            0,
            bulk('idle'),
            0,
            bulk('inactive'),
            0,
          ],
        ]),
        'stream',
        'g',
      ),
      [{ name: 'c', pending: 0, idle: 0, inactive: 0 }],
    );

    const full = await xinfoStream.call(
      createRecorder([
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
        bulk('recorded-first-entry-id'),
        bulk('0-0'),
        bulk('entries'),
        [],
        bulk('groups'),
        [
          [
            bulk('name'),
            bulk('g'),
            bulk('last-delivered-id'),
            bulk('0-0'),
            bulk('entries-read'),
            0,
            bulk('lag'),
            0,
            bulk('pel-count'),
            0,
            bulk('pending'),
            [],
            bulk('consumers'),
            [
              [
                bulk('name'),
                bulk('c'),
                bulk('seen-time'),
                0,
                bulk('active-time'),
                0,
                bulk('pel-count'),
                0,
                bulk('pending'),
                [],
              ],
            ],
          ],
        ],
      ]),
      'stream',
      true,
    );

    if (!('entries' in full)) {
      assert.fail('expected the FULL form');
    }

    assert.strictEqual(full.entriesAdded, 0);
    assert.strictEqual(full.groups[0].entriesRead, 0);
    assert.strictEqual(full.groups[0].lag, 0);
    assert.strictEqual(full.groups[0].consumers[0].activeTime, 0);
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
    assert.strictEqual(tryReplyToNumber(true), 1);
    assert.strictEqual(tryReplyToNumber(false), 0);
    assert.strictEqual(tryReplyToNumber(Buffer.from('2.5')), 2.5);
  });

  it('reads only safe integers as integer replies', () => {
    for (const reply of [1.5, Number.POSITIVE_INFINITY, Number.NaN, 2 ** 60]) {
      for (const options of [undefined, { bigint: true }]) {
        assert.throws(() => tryReplyToInteger(reply, 'INCR', options), {
          name: 'SolidisCommandError',
          message: '[INCR] Unexpected reply: number',
        });
      }
    }

    assert.strictEqual(tryReplyToInteger(-7, 'INCR', undefined), -7);
    assert.strictEqual(tryReplyToInteger(Buffer.from('-12'), 'ROLE'), -12);
    assert.strictEqual(
      tryReplyToInteger('9007199254740993', 'INCR', { bigint: true }),
      9007199254740993n,
    );
    assert.throws(() => tryReplyToInteger('9007199254740993', 'TIME'), {
      message:
        '[TIME] Unexpected reply: integer exceeds Number.MAX_SAFE_INTEGER',
      cause: 9007199254740993n,
    });
    for (const reply of ['1.5', '1e3', '-', ' 1', '1'.repeat(20)]) {
      assert.throws(() => tryReplyToInteger(reply, 'TIME'), {
        message: '[TIME] Unexpected reply: string',
      });
    }
    assert.strictEqual(tryReplyToInteger(-7, 'INCR', { bigint: true }), -7n);
    assert.strictEqual(
      tryReplyToInteger(2n ** 60n, 'INCR', { bigint: true }),
      2n ** 60n,
    );
  });

  it('names the command that returned a malformed module', async () => {
    await assert.rejects(
      hello.call(createRecorder(new Map([['modules', ['x']]]))),
      { message: '[HELLO] Unexpected reply: string' },
    );
    await assert.rejects(moduleList.call(createRecorder([['name', 'x']])), {
      message: '[MODULE LIST] Unexpected reply: missing name or ver',
    });
  });

  it('merges JSON at the root unless a path is given', () => {
    assert.deepStrictEqual(createJsonMergeCommand('key', '{}'), [
      'JSON.MERGE',
      'key',
      '$',
      '{}',
    ]);
    assert.deepStrictEqual(createJsonMergeCommand('key', '{}', '.a'), [
      'JSON.MERGE',
      'key',
      '.a',
      '{}',
    ]);
    assert.deepStrictEqual(createJsonMergeCommand('key', '{}', ''), [
      'JSON.MERGE',
      'key',
      '',
      '{}',
    ]);
  });
});

/** Public types promise exactly what the runtime accepts and returns. */

import assert from 'node:assert/strict';
import { errorMonitor } from 'node:events';
import { describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../sources/client/featured.ts';
import * as commands from '../../../sources/command/index.ts';
import { get, multi, select, set } from '../../../sources/command/index.ts';
import {
  tryReplyToKeyStringElementsOrNull,
  tryReplyToKeyValuePairOrNull,
} from '../../../sources/command/utils/index.ts';
import { SolidisClient } from '../../../sources/index.ts';

import type {
  CommandBufferOptions,
  CommandGetExOptions,
  CommandIntegerOptions,
  CommandSortOptions,
  CommandSortStoreOptions,
  CommandTimeSeriesRangeOptions,
  RespInteger,
  RespLmpop,
  RespOK,
  RespSortedSetMember,
  RespStreamInfo,
  RespStreamInfoFull,
  RespStreamPendingEntry,
  RespStreamPendingInfo,
  RespString,
  SolidisClientExtensions,
  SolidisTransactionClient,
  StringOrBuffer,
  XclaimOptions,
} from '../../../sources/index.ts';

type Is<Actual, Expected> = [Actual] extends [Expected]
  ? [Expected] extends [Actual]
    ? true
    : false
  : false;

type Accepts<Target, Value> = [Value] extends [Target] ? true : false;

type Has<Target, Key extends PropertyKey> = Key extends keyof Target
  ? true
  : false;

type Transaction = SolidisTransactionClient<SolidisFeaturedClient>;

// @ts-expect-error the pipeline bookkeeping of the requester stays private
type Pipeline = import('../../../sources/index.ts').SolidisPipeline;

type CommandUtilities =
  typeof import('../../../sources/command/utils/index.ts');

describe('type-contracts', () => {
  it('types reads by the buffer and bigint flags alone', () => {
    const checks: [
      Is<RespString<undefined>, string>,
      Is<RespString<{ expireInSeconds: number }>, string>,
      Is<RespString<{ persist: true; buffer: false }>, string>,
      Is<RespString<{ expireInSeconds: number; buffer: true }>, Buffer>,
      Is<RespString<CommandBufferOptions>, StringOrBuffer>,
      Is<RespString<CommandBufferOptions | undefined>, StringOrBuffer>,
      Is<RespString<{ buffer?: true }>, StringOrBuffer>,
      Is<RespInteger<undefined>, number>,
      Is<RespInteger<{ other: true }>, number>,
      Is<RespInteger<{ bigint: true }>, bigint>,
      Is<RespInteger<CommandIntegerOptions>, number | bigint>,
    ] = [true, true, true, true, true, true, true, true, true, true, true];

    assert.ok(checks.every(Boolean));
  });

  it('keeps the 0.4.x calls of the reply helpers and the transaction queues internal', () => {
    const pair = tryReplyToKeyValuePairOrNull(null, 'BLPOP');
    const elements = tryReplyToKeyStringElementsOrNull(null, 'LMPOP');
    const checks: [
      Is<typeof pair, [key: string, value: string] | null>,
      Is<typeof elements, RespLmpop<string> | null>,
      Is<Has<CommandUtilities, 'SolidisTransactionQueues'>, false>,
    ] = [true, true, true];

    assert.ok(checks.every(Boolean));
    assert.strictEqual(pair, null);
    assert.strictEqual(elements, null);
  });

  it('lets a transaction call every overload of a command', () => {
    const checks: [
      Accepts<Parameters<Transaction['lpop']>, ['q']>,
      Accepts<Parameters<Transaction['lpop']>, ['q', 2]>,
      Accepts<
        Parameters<Transaction['rpop']>,
        ['q', number | undefined, { buffer: true }]
      >,
      Accepts<Parameters<Transaction['mget']>, ['a', 'b']>,
      Accepts<Parameters<Transaction['mget']>, ['a', { buffer: true }]>,
      Accepts<Parameters<Transaction['hmget']>, ['h', 'a', 'b']>,
      Accepts<Parameters<Transaction['jsonArrlen']>, ['k']>,
      Accepts<Parameters<Transaction['jsonType']>, ['k', '$']>,
      Accepts<Parameters<Transaction['sort']>, ['k', { store: 'target' }]>,
      Accepts<Parameters<Transaction['sort']>, ['k']>,
      Accepts<
        Parameters<Transaction['zrange']>,
        ['k', '0', '-1', { withScores: true }]
      >,
      Accepts<Parameters<Transaction['select']>, [5]>,
    ] = [
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ];

    assert.ok(checks.every(Boolean));
  });

  it('offers only commands on a transaction', () => {
    const absent: [
      Has<Transaction, 'uri'>,
      Has<Transaction, 'reset'>,
      Has<Transaction, 'quit'>,
      Has<Transaction, 'send'>,
      Has<Transaction, 'connect'>,
      Has<Transaction, 'extend'>,
      Has<Transaction, 'on'>,
      Has<Transaction, 'emit'>,
      Has<Transaction, 'watch'>,
      Has<Transaction, 'subscribe'>,
      Has<Transaction, 'scan'>,
      Has<Transaction, 'hscan'>,
      Has<Transaction, 'sscan'>,
      Has<Transaction, 'zscan'>,
    ] = [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ];
    const present: [
      Has<Transaction, 'get'>,
      Has<Transaction, 'info'>,
      Has<Transaction, 'select'>,
      Has<Transaction, 'exec'>,
      Has<Transaction, 'discard'>,
    ] = [true, true, true, true, true];

    assert.ok(!absent.some(Boolean));
    assert.ok(present.every(Boolean));
  });

  it('hides from a transaction every client method it cannot queue', () => {
    const client = new SolidisFeaturedClient({ lazyConnect: true });
    const transaction = client.multi();

    for (const name of [
      'reset',
      'scan',
      'hscan',
      'sscan',
      'zscan',
      'send',
      'pipeline',
      'quit',
      'connect',
      'extend',
      'on',
      'emit',
      'watch',
      'unwatch',
      'subscribe',
      'auth',
      'hello',
      'multi',
    ]) {
      assert.strictEqual(typeof Reflect.get(client, name), 'function', name);
      assert.strictEqual(Reflect.get(transaction, name), undefined, name);
    }

    assert.strictEqual(typeof transaction.get, 'function');

    client.quit();
  });

  it('types a transaction from everything the extended client offers', () => {
    const extended = new SolidisClient({ lazyConnect: true }).extend({
      get,
      set,
      multi,
    });
    const chained = new SolidisClient({ lazyConnect: true })
      .extend({ get, set })
      .extend({ multi });
    const transaction = extended.multi();
    const chainedTransaction = chained.multi();

    transaction.select(2);
    transaction.info();
    transaction.get('k');
    chainedTransaction.get('k');
    chainedTransaction.set('k', 'v');
    // @ts-expect-error a transaction does not send raw commands
    const send: unknown = chainedTransaction.send;

    assert.strictEqual(send, undefined);

    for (const name of ['select', 'info', 'get', 'set']) {
      assert.strictEqual(typeof Reflect.get(transaction, name), 'function');
      assert.strictEqual(
        typeof Reflect.get(chainedTransaction, name),
        'function',
      );
    }

    const renamed = new SolidisClient({ lazyConnect: true }).extend({
      get,
      transaction: multi,
    });
    const answering = new SolidisClient({ lazyConnect: true }).extend({
      multi: () => 42,
    });
    const renamedTransaction = renamed.transaction();
    const answer: number = answering.multi();

    renamedTransaction.get('k');

    assert.strictEqual(
      typeof Reflect.get(renamedTransaction, 'get'),
      'function',
    );
    assert.strictEqual(answer, 42);

    extended.quit();
    chained.quit();
    renamed.quit();
    answering.quit();
  });

  it('types this in an extension as the client it extends', () => {
    const client = new SolidisClient({ lazyConnect: true })
      .extend({ get })
      .extend({
        async read(key: string): Promise<string | null> {
          return await this.get(key);
        },
        async readTwice(key: string) {
          return [await this.read(key), await this.get(key)];
        },
      });
    const checks: [
      Is<ReturnType<typeof client.read>, Promise<string | null>>,
      Is<ReturnType<typeof client.readTwice>, Promise<(string | null)[]>>,
    ] = [true, true];

    assert.deepStrictEqual(checks, [true, true]);
    assert.strictEqual(typeof client.readTwice, 'function');

    client.quit();
  });

  it('accepts an extension only when the client satisfies its declared this', () => {
    async function readAll(this: SolidisFeaturedClient, key: string) {
      return await this.hgetall(key);
    }

    async function readName(this: SolidisClient) {
      return this.uri;
    }

    const minimal = new SolidisClient({ lazyConnect: true });

    // @ts-expect-error readAll needs a client with hgetall
    minimal.extend({ readAll });

    const featured = new SolidisFeaturedClient({ lazyConnect: true }).extend({
      readAll,
    });
    const named = minimal.extend({ readName });

    assert.strictEqual(typeof featured.readAll, 'function');
    assert.strictEqual(typeof named.readName, 'function');

    featured.quit();
    minimal.quit();
  });

  it('adds only functions to a client with extend()', () => {
    type Extended = SolidisClientExtensions<{
      label: string;
      greet: (this: SolidisClient, name: string) => string;
    }>;

    const checks: [
      Has<Extended, 'label'>,
      Is<Extended['greet'], (name: string) => string>,
    ] = [false, true];

    assert.deepStrictEqual(checks, [false, true]);
  });

  it('gives the featured client every command of the command entry point', () => {
    const client = new SolidisFeaturedClient({ lazyConnect: true });

    for (const [name, command] of Object.entries(commands)) {
      const method = client[name];

      if (typeof method !== 'function') {
        assert.fail(`${name} is missing`);
      }

      assert.match(method.name, new RegExp(`^(bound )+${command.name}$`));
    }

    client.quit();
  });

  it('types call sites the way the server answers them', async () => {
    const client = new SolidisFeaturedClient({ lazyConnect: true });

    async function contract(
      sortOptions: CommandSortOptions | CommandSortStoreOptions,
      pipeline: Pipeline,
      rangeOptions: CommandTimeSeriesRangeOptions,
    ) {
      const sorted: number | (string | null)[] = await client.sort(
        'k',
        sortOptions,
      );
      // @ts-expect-error a union of sort options may store the result
      const listed: (string | null)[] = await client.sort('k', sortOptions);
      const members: RespSortedSetMember[] = await client.zrange(
        'k',
        '0',
        '-1',
        { withScores: true },
      );
      const names: string[] = await client.zrange('k', '0', '-1');
      const difference: RespSortedSetMember[] = await client.zdiff(['a'], true);
      const sample: RespSortedSetMember[] = await client.zrandmember(
        'k',
        2,
        true,
      );
      const single: RespSortedSetMember[] = await client.zrandmember(
        'k',
        undefined,
        true,
      );
      const exact: Buffer | null = await client.getex('k', {
        buffer: true,
        expireInSeconds: 60,
      });
      const text: string | null = await client.getex('k', { persist: true });
      const readWith = (options: CommandGetExOptions) =>
        client.getex('k', options);
      const exported: string | Buffer | null = await readWith({
        persist: true,
      });

      // @ts-expect-error getex options stay exact next to buffer
      await client.getex('k', { buffer: true, expireInSecond: 60 });
      // @ts-expect-error MIGRATE moves KEYS only with an empty key
      await client.migrate('host', 6379, 'key', 0, 1000, { keys: ['other'] });
      await client.migrate('host', 6379, '', 0, 1000, { keys: ['other'] });
      const aggregation = { type: 'avg', bucketDuration: 1 };

      await client.tsRange('series', 0, '+', { aggregation, align: 'start' });
      await client.tsRange('series', '-', 10, { aggregation, align: '+' });
      await client.tsRange('series', '-', '+', { aggregation, align: 5 });
      // @ts-expect-error start alignment needs an explicit start
      await client.tsRange('series', '-', '+', { aggregation, align: 'start' });
      // @ts-expect-error end alignment needs an explicit end
      await client.tsRevrange('series', 0, '+', { aggregation, align: 'end' });
      const filter = { a: 'b' };

      await client.tsMrange(0, '+', filter, { aggregation, align: '-' });
      // @ts-expect-error start alignment needs an explicit start
      await client.tsMrevrange('-', '+', filter, { aggregation, align: '-' });
      await client.tsRange('series', 0, 10, { aggregation, align: 'end' });
      await client.tsRevrange('series', 0, 10, { aggregation, align: 'start' });
      await client.tsMrange(0, 10, filter, rangeOptions);
      client.on(errorMonitor, (error: Error) => void error.message);
      client.once(errorMonitor, (error: Error) => void error.message);
      await client.jsonDebug('MEMORY', 'k');
      // @ts-expect-error JSON.DEBUG MEMORY needs a key
      await client.jsonDebug('MEMORY');
      // @ts-expect-error JSON.DEBUG HELP takes no key
      await client.jsonDebug('HELP', 'k');
      await client.bfReserve('b', 0.01, 100, 2);
      await client.bfReserve('b', 0.01, 100, 2, false);
      await client.bfReserve('b', 0.01, 100, undefined, true);
      // @ts-expect-error BF.RESERVE cannot expand a non-scaling filter
      await client.bfReserve('b', 0.01, 100, 2, true);
      await client.expire('k', 10, 'XX GT');
      await client.pexpireat('k', 10, 'XX LT');
      // @ts-expect-error hash fields take one condition
      await client.hexpire('h', 10, ['f'], 'XX GT');

      const found: boolean[] = await client.cfMexists('cf', ['a']);
      const summary: RespStreamInfo = await client.xinfoStream('s');
      const detail: RespStreamInfoFull = await client.xinfoStream('s', true, 5);

      // @ts-expect-error XINFO STREAM takes COUNT only with FULL
      await client.xinfoStream('s', false, 5);
      // @ts-expect-error XINFO STREAM FULL has no first entry
      void detail.firstEntry;
      await client.tsAdd('series', '*', 1);
      await client.tsMadd('series', [{ timestamp: '*', value: 1 }]);
      await client.tsDel('series', '-', '+');
      await client.tsIncrby('series', 1, { timestamp: '*' });
      await client.tsDecrby('series', 1, { timestamp: 5 });
      await client.latencyHistogram();
      await client.bitop('DIFF', 'target', ['a', 'b']);
      await client.auth(Buffer.from('user'), Buffer.from([0xff]));
      await client.auth('password');
      // @ts-expect-error AUTH needs a password
      await client.auth();
      // @ts-expect-error AUTH needs a password after a username
      await client.auth('user', undefined);

      const symbol = Symbol('extension');
      const extended = client.extend({ [symbol]: async () => 1 });

      // @ts-expect-error extend() installs no symbol-keyed member
      void extended[symbol];
      await client.hello('RESP3', Buffer.from('user'), Buffer.from([0xff]));
      client.scan({ type: 'ReJSON-RL' });
      client.scan({ type: 'hash' });
      await client.zcount('k', '(1', '+inf');
      await client.zrangebyscore('k', '-inf', '(5', { withScores: true });
      await client.zrevrangebyscore('k', '+inf', '-inf');
      await client.zremrangebyscore('k', '(0', 10);
      await client.publish('channel', Buffer.from([0xff]));
      await client.spublish('channel', Buffer.from([0xff]));
      await client.set('k', 'v', {
        returnOldValue: true,
        returnOldValueAsBuffer: true,
      });
      // @ts-expect-error returnOldValueAsBuffer needs returnOldValue
      await client.set('k', 'v', { returnOldValueAsBuffer: true });

      const written: RespOK | null = await client.set('k', 'v', {
        expireInSeconds: 1,
      });
      const previous: string | null = await client.set('k', 'v', {
        returnOldValue: true,
      });
      const previousBytes: Buffer | null = await client.set('k', 'v', {
        returnOldValue: true,
        returnOldValueAsBuffer: true,
      });

      // @ts-expect-error a plain SET answers OK, not the old value
      const unwritten: Buffer | null = await client.set('k', 'v');

      await client.replicaof('NO', 'ONE');
      await client.replicaof('10.0.0.1', 6379);
      // @ts-expect-error only NO takes ONE as the port
      await client.replicaof('10.0.0.1', 'ONE');
      await client.scriptDebug('NO');
      // @ts-expect-error SCRIPT DEBUG YES breaks the pairing of replies
      await client.scriptDebug('YES');
      await client.bitpos('k', 0, { start: 0, end: -1, mode: 'BIT' });
      // @ts-expect-error BITPOS takes a mode only with an end
      await client.bitpos('k', 0, { mode: 'BYTE' });
      await client.bitfield('k', [
        { operation: 'GET', type: 'u8', offset: '#1' },
      ]);
      await client.bitfieldRo('k', [{ type: 'u8', offset: '#1' }]);
      await client.hello();
      await client.hello('RESP3', undefined, 'password');
      await client.hello('RESP2', undefined, undefined, 'name');
      // @ts-expect-error HELLO authenticates and names only after a protocol
      await client.hello(undefined, 'user', 'password');
      // @ts-expect-error HELLO sends a username only with a password
      await client.hello('RESP3', 'user');

      const keys: (string | undefined)[] = [];

      await client.mget('a', 'b', undefined);
      // @ts-expect-error MGET takes options only last
      await client.mget('a', undefined, 'b');
      // @ts-expect-error MGET keys are strings
      await client.mget(...keys);
      // @ts-expect-error HMGET takes options only last
      await client.hmget('h', 'a', undefined, 'b');
      // @ts-expect-error HMGET fields are strings
      await client.hmget('h', ...keys);
      // @ts-expect-error HELLO sends a username only with a password
      await client.hello('RESP3', 'user', undefined, 'name');

      for (const { event } of await client.latencyLatest()) {
        await client.latencyHistory(event);
        await client.latencyGraph(event);
        await client.latencyReset([event, 'module-acquire-GIL']);
      }

      await client.clientList({ identifiers: [1] });
      // @ts-expect-error CLIENT LIST takes TYPE or ID, not both
      await client.clientList({ type: 'NORMAL', identifiers: [1] });

      const pendingSummary: RespStreamPendingInfo = await client.xpending(
        's',
        'g',
      );
      const pendingEntries: RespStreamPendingEntry[] = await client.xpending(
        's',
        'g',
        '-',
        '+',
        10,
      );

      // @ts-expect-error XPENDING takes an end and a count with a start
      await client.xpending('s', 'g', '-');

      const { multi } = client;
      const options: XclaimOptions = { justid: true };

      multi().get('k');

      return [
        sorted,
        listed,
        members,
        names,
        difference,
        sample,
        single,
        exact,
        text,
        exported,
        options,
        pipeline,
        pendingSummary,
        pendingEntries,
        found,
        summary,
        detail,
        written,
        previous,
        previousBytes,
        unwritten,
      ];
    }

    assert.strictEqual(typeof contract, 'function');
    assert.strictEqual(typeof select, 'function');

    client.quit();
  });
});

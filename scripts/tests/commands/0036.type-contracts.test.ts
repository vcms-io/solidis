/** Public types promise exactly what the runtime accepts and returns. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../sources/client/featured.ts';
import { get, multi, select, set } from '../../../sources/command/index.ts';
import { SolidisClient } from '../../../sources/index.ts';

import type {
  CommandBufferOptions,
  CommandIntegerOptions,
  CommandSortOptions,
  CommandSortStoreOptions,
  RespInteger,
  RespSortedSetMember,
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

    transaction.discard();
    chainedTransaction.discard();
    extended.quit();
    chained.quit();
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

  it('types call sites the way the server answers them', async () => {
    const client = new SolidisFeaturedClient({ lazyConnect: true });

    async function contract(
      sortOptions: CommandSortOptions | CommandSortStoreOptions,
      pipeline: Pipeline,
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
      const exact: Buffer | null = await client.getex('k', {
        buffer: true,
        expireInSeconds: 60,
      });
      const text: string | null = await client.getex('k', { persist: true });

      // @ts-expect-error getex options stay exact next to buffer
      await client.getex('k', { buffer: true, expireInSecond: 60 });
      // @ts-expect-error MIGRATE moves KEYS only with an empty key
      await client.migrate('host', 6379, 'key', 0, 1000, { keys: ['other'] });
      await client.migrate('host', 6379, '', 0, 1000, { keys: ['other'] });
      await client.tsRange('series', '-', '+', {
        aggregation: { type: 'avg', bucketDuration: 1 },
        align: 'start',
      });
      await client.tsAdd('series', '*', 1);
      await client.tsMadd('series', [{ timestamp: '*', value: 1 }]);
      await client.tsDel('series', '-', '+');
      await client.tsIncrby('series', 1, { timestamp: '*' });
      await client.tsDecrby('series', 1, { timestamp: 5 });
      await client.latencyHistogram();
      await client.bitop('DIFF', 'target', ['a', 'b']);
      await client.auth(Buffer.from('user'), Buffer.from([0xff]));
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
        exact,
        text,
        options,
        pipeline,
        pendingSummary,
        pendingEntries,
      ];
    }

    assert.strictEqual(typeof contract, 'function');
    assert.strictEqual(typeof select, 'function');

    client.quit();
  });
});

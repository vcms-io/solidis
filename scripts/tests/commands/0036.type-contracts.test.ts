/** Public types promise exactly what the runtime accepts and returns. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SolidisFeaturedClient } from '../../../sources/client/featured.ts';
import { select } from '../../../sources/command/index.ts';

import type {
  CommandBufferOptions,
  CommandIntegerOptions,
  CommandSortOptions,
  CommandSortStoreOptions,
  RespInteger,
  RespSortedSetMember,
  RespString,
  SolidisClient,
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
    ] = [false, false, false, false, false, false, false, false, false, false];
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
      ];
    }

    assert.strictEqual(typeof contract, 'function');
    assert.strictEqual(typeof select, 'function');

    client.quit();
  });
});

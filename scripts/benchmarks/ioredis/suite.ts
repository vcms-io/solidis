import { SolidisClientAdapter } from '../shared/adapters/solidis.ts';
import {
  buildCounter,
  buildExpire,
  buildHashMutation,
  buildHashRoundTrip,
  buildInfoConfig,
  buildListMutation,
  buildListRange,
  buildMultiKey,
  buildNonTransaction,
  buildPipelineMixed,
  buildSetMutation,
  buildSetRead,
  buildSortedSet,
  buildStream,
  buildTransaction,
  buildTransactionMixed,
  verifyCounter,
  verifyExpire,
  verifyHashMutation,
  verifyHashRoundTrip,
  verifyInfoConfig,
  verifyListMutation,
  verifyListRange,
  verifyMultiKey,
  verifyNonTransaction,
  verifyPipelineMixed,
  verifySetMutation,
  verifySetRead,
  verifySortedSet,
  verifyStream,
  verifyTransaction,
  verifyTransactionMixed,
} from '../shared/commands.ts';
import { createPubSubCase } from '../shared/pubsub.ts';
import { BenchmarkSuite } from '../shared/suite.ts';
import { ansi } from '../shared/utils.ts';
import { assertBufferEquals, assertOk } from '../shared/verification.ts';
import { IORedisClientAdapter } from './adapters/ioredis.ts';
import { getComparableModes, getNonComparableReason } from './comparable.ts';

import type {
  BenchConfig,
  BenchmarkCase,
  BenchmarkMode,
  Command,
} from '../shared/types.ts';

export class IORedisComparisonSuite extends BenchmarkSuite {
  readonly name = 'solidis';
  readonly baselineLibrary = 'ioredis';
  readonly adapters = [
    new IORedisClientAdapter(),
    new SolidisClientAdapter(),
  ] as const;

  getComparableModes(commands: Command[]): ReadonlySet<BenchmarkMode> {
    return getComparableModes(commands);
  }

  getNonComparableReason(commands: Command[]): string | undefined {
    return getNonComparableReason(commands);
  }

  buildBenchmarkCases(): BenchmarkCase[] {
    return [
      this.commandCase({
        name: 'set',
        unit: (prefix, unitIndex, payloadAt) => [
          ['SET', `${prefix}:set:${unitIndex}`, payloadAt(0)],
        ],
        verify: (responses) => {
          assertOk(responses[0], 'SET');
        },
      }),
      this.commandCase({
        name: 'getBuffer',
        setup: (prefix, payloadAt, units) =>
          Array.from({ length: units }, (_, unitIndex) => [
            'SET',
            `${prefix}:value:${unitIndex}`,
            payloadAt(unitIndex),
          ]),
        unit: (prefix, unitIndex) => [['GET', `${prefix}:value:${unitIndex}`]],
        verify: (responses, _payloadAt, context) => {
          assertBufferEquals(
            responses[0],
            context.payloadAt(context.absoluteUnitIndex),
            'GET',
          );
        },
      }),
      this.commandCase({
        name: 'hash:HSET+HGET+HGETALL',
        unit: buildHashRoundTrip,
        verify: verifyHashRoundTrip,
      }),
      this.commandCase({
        name: 'hash:HMSET+HMGET+HDEL',
        payloadSlotsPerUnit: 2,
        unit: buildHashMutation,
        verify: verifyHashMutation,
      }),
      this.commandCase({
        name: 'set:SADD+SISMEMBER+SMEMBERS',
        unit: buildSetRead,
        verify: verifySetRead,
      }),
      this.commandCase({
        name: 'set:SADD+SISMEMBER+SREM',
        unit: buildSetMutation,
        verify: verifySetMutation,
      }),
      this.commandCase({
        name: 'expire:SET+EXPIRE+TTL',
        unit: buildExpire,
        verify: verifyExpire,
      }),
      this.commandCase({
        name: 'nonTx:SETPX+GET',
        unit: buildNonTransaction,
        verify: verifyNonTransaction,
      }),
      this.commandCase({
        name: 'list:LPUSH+RPUSH+LRANGE',
        payloadSlotsPerUnit: 2,
        unit: buildListRange,
        verify: verifyListRange,
      }),
      this.commandCase({
        name: 'list:LPUSH+RPUSH+LPOP+RPOP+LLEN',
        payloadSlotsPerUnit: 2,
        unit: buildListMutation,
        verify: verifyListMutation,
      }),
      this.commandCase({
        name: 'counter:INCR+DECR',
        unit: buildCounter,
        verify: verifyCounter,
      }),
      this.commandCase({
        name: 'transaction:SET+EXPIRE+GET',
        unit: buildTransaction,
        verify: verifyTransaction,
        executionMode: 'batch',
      }),
      this.commandCase({
        name: 'transactionMixed:SET+GET',
        payloadSlotsPerUnit: 2,
        unit: buildTransactionMixed,
        verify: verifyTransactionMixed,
        executionMode: 'batch',
      }),
      this.commandCase({
        name: 'multiKey:MSET+MGET',
        payloadSlotsPerUnit: 2,
        unit: buildMultiKey,
        verify: verifyMultiKey,
      }),
      this.commandCase({
        name: 'pipeline:SET+INCR+GET',
        unit: buildPipelineMixed,
        verify: verifyPipelineMixed,
      }),
      this.commandCase({
        name: 'stream:XADD+XRANGE+XLEN',
        unit: buildStream,
        verify: verifyStream,
      }),
      this.commandCase({
        name: 'zset:ZADD+ZRANGE+ZREM',
        payloadSlotsPerUnit: 2,
        unit: buildSortedSet,
        verify: verifySortedSet,
      }),
      this.commandCase({
        name: 'info:INFO+CONFIGGET',
        unit: buildInfoConfig,
        verify: verifyInfoConfig,
      }),
      createPubSubCase(this),
    ];
  }

  printFairnessPolicy(_config: BenchConfig): void {
    console.log(`  ${ansi.dim}Fairness policy:${ansi.reset}`);
    console.log(`  ${ansi.dim}  • Raw Buffer commands only${ansi.reset}`);
    console.log(
      `  ${ansi.dim}  • Deterministic preallocated payload pool shared by both libraries${ansi.reset}`,
    );
    console.log(
      `  ${ansi.dim}  • Same explicit pipeline shape in batch mode${ansi.reset}`,
    );
    console.log(
      `  ${ansi.dim}  • Autopipeline excludes commands ioredis does not auto-pipeline${ansi.reset}`,
    );
    console.log('');
  }
}

export const ioredisSuite = new IORedisComparisonSuite();

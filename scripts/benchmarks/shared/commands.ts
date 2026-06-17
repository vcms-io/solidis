import {
  assertArrayLength,
  assertArrayMinLength,
  assertBufferEquals,
  assertHashContains,
  assertInteger,
  assertIntegerEquals,
  assertNonNull,
  assertOk,
} from './verification.ts';

import type { Command, CommandVerifier, PayloadAccessor } from './types.ts';

export function buildHashRoundTrip(
  prefix: string,
  unitIndex: number,
  payloadAt: PayloadAccessor,
): Command[] {
  const key = `${prefix}:hash:${unitIndex}`;

  return [
    ['HSET', key, 'field', payloadAt(0)],
    ['HGET', key, 'field'],
    ['HGETALL', key],
  ];
}

export function buildHashMutation(
  prefix: string,
  unitIndex: number,
  payloadAt: PayloadAccessor,
): Command[] {
  const key = `${prefix}:hashMutation:${unitIndex}`;

  return [
    ['HMSET', key, 'a', payloadAt(0), 'b', payloadAt(0, 1)],
    ['HMGET', key, 'a', 'b'],
    ['HDEL', key, 'a', 'b'],
  ];
}

export function buildSetRead(
  prefix: string,
  unitIndex: number,
  payloadAt: PayloadAccessor,
): Command[] {
  const key = `${prefix}:setRead:${unitIndex}`;

  return [
    ['SADD', key, payloadAt(0)],
    ['SISMEMBER', key, payloadAt(0)],
    ['SMEMBERS', key],
  ];
}

export function buildSetMutation(
  prefix: string,
  unitIndex: number,
  payloadAt: PayloadAccessor,
): Command[] {
  const key = `${prefix}:setMutation:${unitIndex}`;

  return [
    ['SADD', key, payloadAt(0)],
    ['SISMEMBER', key, payloadAt(0)],
    ['SREM', key, payloadAt(0)],
  ];
}

export function buildExpire(
  prefix: string,
  unitIndex: number,
  payloadAt: PayloadAccessor,
): Command[] {
  const key = `${prefix}:expire:${unitIndex}`;

  return [
    ['SET', key, payloadAt(0)],
    ['EXPIRE', key, '60'],
    ['TTL', key],
  ];
}

export function buildNonTransaction(
  prefix: string,
  unitIndex: number,
  payloadAt: PayloadAccessor,
): Command[] {
  const key = `${prefix}:nonTx:${unitIndex}`;

  return [
    ['SET', key, payloadAt(0), 'PX', '60000'],
    ['GET', key],
  ];
}

export function buildListRange(
  prefix: string,
  unitIndex: number,
  payloadAt: PayloadAccessor,
): Command[] {
  const key = `${prefix}:listRange:${unitIndex}`;

  return [
    ['LPUSH', key, payloadAt(0)],
    ['RPUSH', key, payloadAt(0, 1)],
    ['LRANGE', key, '0', '-1'],
  ];
}

export function buildListMutation(
  prefix: string,
  unitIndex: number,
  payloadAt: PayloadAccessor,
): Command[] {
  const key = `${prefix}:listMutation:${unitIndex}`;

  return [
    ['LPUSH', key, payloadAt(0)],
    ['RPUSH', key, payloadAt(0, 1)],
    ['LPOP', key],
    ['RPOP', key],
    ['LLEN', key],
  ];
}

export function buildCounter(prefix: string, unitIndex: number): Command[] {
  const key = `${prefix}:counter:${unitIndex}`;

  return [
    ['INCR', key],
    ['DECR', key],
  ];
}

export function buildTransaction(
  prefix: string,
  unitIndex: number,
  payloadAt: PayloadAccessor,
): Command[] {
  const key = `${prefix}:tx:${unitIndex}`;

  return [
    ['MULTI'],
    ['SET', key, payloadAt(0)],
    ['EXPIRE', key, '60'],
    ['GET', key],
    ['EXEC'],
  ];
}

export function buildTransactionMixed(
  prefix: string,
  unitIndex: number,
  payloadAt: PayloadAccessor,
): Command[] {
  const key = `${prefix}:txMixed:${unitIndex}`;
  const plainKey = `${key}:plain`;

  return [
    ['SET', plainKey, payloadAt(0)],
    ['GET', plainKey],
    ['MULTI'],
    ['SET', key, payloadAt(0, 1)],
    ['GET', key],
    ['EXEC'],
  ];
}

export function buildMultiKey(
  prefix: string,
  unitIndex: number,
  payloadAt: PayloadAccessor,
): Command[] {
  const first = `${prefix}:multi:${unitIndex}:1`;
  const second = `${prefix}:multi:${unitIndex}:2`;

  return [
    ['MSET', first, payloadAt(0), second, payloadAt(0, 1)],
    ['MGET', first, second],
  ];
}

export function buildPipelineMixed(
  prefix: string,
  unitIndex: number,
  payloadAt: PayloadAccessor,
): Command[] {
  const key = `${prefix}:pipeline:${unitIndex}`;
  const counter = `${key}:counter`;

  return [
    ['SET', key, payloadAt(0)],
    ['INCR', counter],
    ['GET', key],
  ];
}

export function buildStream(
  prefix: string,
  unitIndex: number,
  payloadAt: PayloadAccessor,
): Command[] {
  const key = `${prefix}:stream:${unitIndex}`;

  return [
    ['XADD', key, '*', 'field', payloadAt(0)],
    ['XRANGE', key, '-', '+'],
    ['XLEN', key],
  ];
}

export function buildSortedSet(
  prefix: string,
  unitIndex: number,
  payloadAt: PayloadAccessor,
): Command[] {
  const key = `${prefix}:zset:${unitIndex}`;

  return [
    ['ZADD', key, `${unitIndex}`, payloadAt(0)],
    ['ZRANGE', key, '0', '-1', 'WITHSCORES'],
    ['ZREM', key, payloadAt(0)],
  ];
}

export function buildInfoConfig(): Command[] {
  return [
    ['INFO', 'server'],
    ['CONFIG', 'GET', 'maxmemory'],
  ];
}

export const verifyHashRoundTrip: CommandVerifier = (responses, payloadAt) => {
  assertIntegerEquals(responses[0], 1, 'HSET');
  assertBufferEquals(responses[1], payloadAt(0), 'HGET');
  assertHashContains(responses[2], 'field', payloadAt(0), 'HGETALL');
};

export const verifyHashMutation: CommandVerifier = (responses, payloadAt) => {
  assertOk(responses[0], 'HMSET');
  const values = assertArrayMinLength(responses[1], 2, 'HMGET');
  assertBufferEquals(values[0], payloadAt(0), 'HMGET[0]');
  assertBufferEquals(values[1], payloadAt(0, 1), 'HMGET[1]');
  assertIntegerEquals(responses[2], 2, 'HDEL');
};

export const verifySetRead: CommandVerifier = (responses, payloadAt) => {
  assertIntegerEquals(responses[0], 1, 'SADD');
  assertIntegerEquals(responses[1], 1, 'SISMEMBER');
  const members = assertArrayLength(responses[2], 1, 'SMEMBERS');
  assertBufferEquals(members[0], payloadAt(0), 'SMEMBERS[0]');
};

export const verifySetMutation: CommandVerifier = (responses) => {
  assertIntegerEquals(responses[0], 1, 'SADD');
  assertIntegerEquals(responses[1], 1, 'SISMEMBER');
  assertIntegerEquals(responses[2], 1, 'SREM');
};

export const verifyExpire: CommandVerifier = (responses) => {
  assertOk(responses[0], 'SET');
  assertIntegerEquals(responses[1], 1, 'EXPIRE');
  assertInteger(responses[2], 'TTL');
};

export const verifyNonTransaction: CommandVerifier = (responses, payloadAt) => {
  assertOk(responses[0], 'SET');
  assertBufferEquals(responses[1], payloadAt(0), 'GET');
};

export const verifyListRange: CommandVerifier = (responses, payloadAt) => {
  assertIntegerEquals(responses[0], 1, 'LPUSH');
  assertIntegerEquals(responses[1], 2, 'RPUSH');
  const items = assertArrayMinLength(responses[2], 2, 'LRANGE');
  assertBufferEquals(items[0], payloadAt(0), 'LRANGE[0]');
  assertBufferEquals(items[1], payloadAt(0, 1), 'LRANGE[1]');
};

export const verifyListMutation: CommandVerifier = (responses, payloadAt) => {
  assertIntegerEquals(responses[0], 1, 'LPUSH');
  assertIntegerEquals(responses[1], 2, 'RPUSH');
  assertBufferEquals(responses[2], payloadAt(0), 'LPOP');
  assertBufferEquals(responses[3], payloadAt(0, 1), 'RPOP');
  assertIntegerEquals(responses[4], 0, 'LLEN');
};

export const verifyCounter: CommandVerifier = (responses) => {
  assertIntegerEquals(responses[0], 1, 'INCR');
  assertIntegerEquals(responses[1], 0, 'DECR');
};

export const verifyTransaction: CommandVerifier = (responses, payloadAt) => {
  assertOk(responses[0], 'MULTI');
  const execResult = assertArrayMinLength(responses[4], 3, 'EXEC');
  assertOk(execResult[0], 'EXEC:SET');
  assertIntegerEquals(execResult[1], 1, 'EXEC:EXPIRE');
  assertBufferEquals(execResult[2], payloadAt(0), 'EXEC:GET');
};

export const verifyTransactionMixed: CommandVerifier = (
  responses,
  payloadAt,
) => {
  assertOk(responses[0], 'SET');
  assertBufferEquals(responses[1], payloadAt(0), 'GET');
  assertOk(responses[2], 'MULTI');
  const execResult = assertArrayMinLength(responses[5], 2, 'EXEC');
  assertOk(execResult[0], 'EXEC:SET');
  assertBufferEquals(execResult[1], payloadAt(0, 1), 'EXEC:GET');
};

export const verifyMultiKey: CommandVerifier = (responses, payloadAt) => {
  assertOk(responses[0], 'MSET');
  const values = assertArrayMinLength(responses[1], 2, 'MGET');
  assertBufferEquals(values[0], payloadAt(0), 'MGET[0]');
  assertBufferEquals(values[1], payloadAt(0, 1), 'MGET[1]');
};

export const verifyPipelineMixed: CommandVerifier = (responses, payloadAt) => {
  assertOk(responses[0], 'SET');
  assertIntegerEquals(responses[1], 1, 'INCR');
  assertBufferEquals(responses[2], payloadAt(0), 'GET');
};

export const verifyStream: CommandVerifier = (responses) => {
  assertNonNull(responses[0], 'XADD');
  assertArrayMinLength(responses[1], 1, 'XRANGE');
  assertIntegerEquals(responses[2], 1, 'XLEN');
};

export const verifySortedSet: CommandVerifier = (responses) => {
  assertIntegerEquals(responses[0], 1, 'ZADD');
  assertArrayMinLength(responses[1], 1, 'ZRANGE');
  assertIntegerEquals(responses[2], 1, 'ZREM');
};

export const verifyInfoConfig: CommandVerifier = (responses) => {
  assertNonNull(responses[0], 'INFO');
  assertNonNull(responses[1], 'CONFIG GET');
};

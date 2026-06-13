import {
  executeCommand,
  tryReplyToStringsOrSortedSetMembers,
} from './utils/index.ts';

import type {
  CommandLimitWithScoresOptions,
  RespSortedSetMember,
} from '../index.ts';

export function createCommand(
  key: string,
  min: number,
  max: number,
  options?: CommandLimitWithScoresOptions,
) {
  const command = ['ZRANGEBYSCORE', key, `${min}`, `${max}`];

  if (options?.withScores) {
    command.push('WITHSCORES');
  }

  if (options?.limit) {
    command.push('LIMIT', `${options.limit.offset}`, `${options.limit.count}`);
  }

  return command;
}

export async function zrangebyscore<T>(
  this: T,
  key: string,
  min: number,
  max: number,
  options?: CommandLimitWithScoresOptions,
): Promise<string[] | RespSortedSetMember[]> {
  return await executeCommand(
    this,
    createCommand(key, min, max, options),
    (reply, command) =>
      tryReplyToStringsOrSortedSetMembers(reply, command, options?.withScores),
  );
}

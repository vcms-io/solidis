import {
  executeCommand,
  tryReplyToStringsOrSortedSetMembers,
} from './utils/index.ts';

import type {
  CommandLimitWithScoresOptions,
  CommandScoreBound,
  RespSortedSetMember,
} from '../index.ts';

export function createCommand(
  key: string,
  min: CommandScoreBound,
  max: CommandScoreBound,
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
  min: CommandScoreBound,
  max: CommandScoreBound,
  options: CommandLimitWithScoresOptions & { withScores: true },
): Promise<RespSortedSetMember[]>;
export async function zrangebyscore<T>(
  this: T,
  key: string,
  min: CommandScoreBound,
  max: CommandScoreBound,
  options?: CommandLimitWithScoresOptions & { withScores?: false },
): Promise<string[]>;
export async function zrangebyscore<T>(
  this: T,
  key: string,
  min: CommandScoreBound,
  max: CommandScoreBound,
  options?: CommandLimitWithScoresOptions,
): Promise<string[] | RespSortedSetMember[]>;
export async function zrangebyscore<T>(
  this: T,
  key: string,
  min: CommandScoreBound,
  max: CommandScoreBound,
  options?: CommandLimitWithScoresOptions,
): Promise<string[] | RespSortedSetMember[]> {
  return await executeCommand(
    this,
    createCommand(key, min, max, options),
    (reply, command, replyOptions) =>
      tryReplyToStringsOrSortedSetMembers(
        reply,
        command,
        replyOptions?.withScores,
      ),
    options,
  );
}

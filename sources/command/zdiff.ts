import {
  executeCommand,
  tryReplyToStringsOrSortedSetMembers,
} from './utils/index.ts';

import type { RespSortedSetMember } from '../index.ts';

export function createCommand(keys: string[], withScores?: boolean) {
  const command = ['ZDIFF', `${keys.length}`, ...keys];

  if (withScores) {
    command.push('WITHSCORES');
  }

  return command;
}

export async function zdiff<T>(
  this: T,
  keys: string[],
  withScores?: boolean,
): Promise<string[] | RespSortedSetMember[]> {
  return await executeCommand(
    this,
    createCommand(keys, withScores),
    (reply, command) =>
      tryReplyToStringsOrSortedSetMembers(reply, command, withScores),
  );
}

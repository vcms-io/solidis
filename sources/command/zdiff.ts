import {
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
  processPairedArray,
  tryReplyToNumber,
  tryReplyToStringArray,
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
    (reply, command) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      if (!withScores) {
        return tryReplyToStringArray(reply, command);
      }

      const result: RespSortedSetMember[] = [];

      processPairedArray(
        reply,
        (member, score) => {
          result.push({
            member,
            score: tryReplyToNumber(score, command),
          });
        },
        'ZDIFF',
      );

      return result;
    },
  );
}

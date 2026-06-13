import {
  executeCommand,
  newCommandError,
  tryReplyToSortedSetMembers,
  tryReplyToStringArray,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { RespSortedSetMember } from '../index.ts';

export function createCommand(
  key: string,
  count?: number,
  withScores?: boolean,
) {
  const command = ['ZRANDMEMBER', key];

  if (count !== undefined) {
    command.push(`${count}`);
  }

  if (withScores) {
    command.push('WITHSCORES');
  }

  return command;
}

export async function zrandmember<T>(
  this: T,
  key: string,
  count?: number,
  withScores?: boolean,
): Promise<string | string[] | RespSortedSetMember[] | null> {
  return await executeCommand(
    this,
    createCommand(key, count, withScores),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (count === undefined && !withScores) {
        if (!(typeof reply === 'string' || reply instanceof Buffer)) {
          throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
        }

        return `${reply}`;
      }

      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      if (!withScores) {
        return tryReplyToStringArray(reply, command);
      }

      return tryReplyToSortedSetMembers(reply, command);
    },
  );
}

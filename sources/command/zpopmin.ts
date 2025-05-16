import {
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
  processPairedArray,
  tryReplyToNumber,
} from './utils/index.ts';

import type { RespSortedSetMember } from '../index.ts';

export function createCommand(key: string, count?: number) {
  const command = ['ZPOPMIN', key];

  if (count !== undefined) {
    command.push(`${count}`);
  }

  return command;
}

export async function zpopmin<T>(
  this: T,
  key: string,
  count?: number,
): Promise<RespSortedSetMember[] | null> {
  return await executeCommand(
    this,
    createCommand(key, count),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      const results: RespSortedSetMember[] = [];

      processPairedArray(
        reply,
        (member, score) => {
          results.push({
            member,
            score: tryReplyToNumber(score, command),
          });
        },
        'ZPOPMIN',
      );

      return results;
    },
  );
}

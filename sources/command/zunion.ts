import {
  UnexpectedReplyPrefix,
  buildSortedSetInterCommand,
  executeCommand,
  newCommandError,
  processPairedArray,
  tryReplyToNumber,
  tryReplyToStringArray,
} from './utils/index.ts';

import type {
  CommandZInterWithScoreOptions,
  RespSortedSetMember,
} from '../index.ts';

export function createCommand(
  keys: string[],
  options: CommandZInterWithScoreOptions = {},
) {
  const command = buildSortedSetInterCommand(['ZUNION'], keys, options);

  if (options.withScores) {
    command.push('WITHSCORES');
  }

  return command;
}

export async function zunion<T>(
  this: T,
  keys: string[],
  options: CommandZInterWithScoreOptions = {},
): Promise<string[] | RespSortedSetMember[]> {
  return await executeCommand(
    this,
    createCommand(keys, options),
    (reply, command) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      if (!options.withScores) {
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
        'ZUNION',
      );

      return result;
    },
  );
}

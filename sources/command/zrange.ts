import {
  UnexpectedReplyPrefix,
  buildSortedSetRangeCommand,
  executeCommand,
  newCommandError,
  processPairedArray,
  tryReplyToNumber,
  tryReplyToStringArray,
} from './utils/index.ts';

import type { CommandZRangeOptions, RespSortedSetMember } from '../index.ts';

export function createCommand(
  key: string,
  min: string,
  max: string,
  options: CommandZRangeOptions,
) {
  return buildSortedSetRangeCommand(['ZRANGE', key, min, max], options);
}

export async function zrange<T>(
  this: T,
  key: string,
  min: string,
  max: string,
  options: CommandZRangeOptions = {},
): Promise<string[] | RespSortedSetMember[]> {
  return await executeCommand(
    this,
    createCommand(key, min, max, options),
    (reply, command) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      if (!options.withScores) {
        return tryReplyToStringArray(reply, command);
      }

      const result: RespSortedSetMember[] = [];

      processPairedArray(
        reply.flat(),
        (member, score) => {
          result.push({
            member,
            score: tryReplyToNumber(score, command),
          });
        },
        'ZRANGE',
      );

      return result;
    },
  );
}

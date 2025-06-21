import {
  executeCommand,
  newCommandError,
  processPairedArray,
  tryReplyToNumber,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { CommandMinOrMaxOption, RespSortedSetMember } from '../index.ts';

export function createCommand(
  keys: string[],
  where: CommandMinOrMaxOption,
  count?: number,
) {
  const command = ['ZMPOP', `${keys.length}`, ...keys, where];

  if (count !== undefined) {
    command.push('COUNT', `${count}`);
  }

  return command;
}

export async function zmpop<T>(
  this: T,
  keys: string[],
  where: CommandMinOrMaxOption,
  count?: number,
): Promise<{
  key: string;
  elements: RespSortedSetMember[];
} | null> {
  return await executeCommand(
    this,
    createCommand(keys, where, count),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (!Array.isArray(reply) || reply.length !== 2) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      const [key, elements] = reply;

      if (!(typeof key === 'string' || key instanceof Buffer)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      if (!Array.isArray(elements)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      const results: RespSortedSetMember[] = [];

      processPairedArray(
        elements,
        (member, score) => {
          results.push({
            member,
            score: tryReplyToNumber(score, command),
          });
        },
        'ZMPOP',
      );

      return {
        key: `${key}`,
        elements: results,
      };
    },
  );
}

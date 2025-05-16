import {
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
  processPairedArray,
  tryReplyToNumber,
} from './utils/index.ts';

import type { CommandMinOrMaxOption, RespSortedSetMember } from '../index.ts';

export function createCommand(
  timeout: number,
  keys: string[],
  where: CommandMinOrMaxOption,
  count?: number,
) {
  const command = ['BZMPOP', `${timeout}`, `${keys.length}`, ...keys, where];

  if (count !== undefined) {
    command.push('COUNT', `${count}`);
  }

  return command;
}

export async function bzmpop<T>(
  this: T,
  timeout: number,
  keys: string[],
  where: CommandMinOrMaxOption,
  count?: number,
): Promise<{
  key: string;
  elements: RespSortedSetMember[];
} | null> {
  return await executeCommand(
    this,
    createCommand(timeout, keys, where, count),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (!Array.isArray(reply) || reply.length !== 2) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      const [key, elements] = reply;

      if (!(typeof key === 'string' || key instanceof Buffer)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${key}`, command);
      }

      if (!Array.isArray(elements)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${elements}`, command);
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
        'BZMPOP',
      );

      return {
        key: `${key}`,
        elements: results,
      };
    },
  );
}

import {
  executeCommand,
  newCommandError,
  tryReplyToStringArray,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { CommandLeftOrRightOption, RespListMember } from '../index.ts';

export function createCommand(
  timeout: number,
  keys: string[],
  where: CommandLeftOrRightOption,
  count?: number,
) {
  const command = ['BLMPOP', `${timeout}`, `${keys.length}`, ...keys, where];

  if (count !== undefined) {
    command.push('COUNT', `${count}`);
  }

  return command;
}

export async function blmpop<T>(
  this: T,
  timeout: number,
  keys: string[],
  where: CommandLeftOrRightOption,
  count?: number,
): Promise<{
  key: string;
  elements: RespListMember[];
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

      return {
        key: `${key}`,
        elements: tryReplyToStringArray(elements, command),
      };
    },
  );
}

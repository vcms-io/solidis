import {
  executeCommand,
  newCommandError,
  tryReplyToStringArray,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { CommandLeftOrRightOption, RespLmpop } from '../index.ts';

export function createCommand(
  keys: string[],
  direction: CommandLeftOrRightOption,
  count?: number,
) {
  const command = ['LMPOP', `${keys.length}`, ...keys, direction];

  if (count !== undefined) {
    command.push('COUNT', `${count}`);
  }

  return command;
}

export async function lmpop<T>(
  this: T,
  keys: string[],
  direction: CommandLeftOrRightOption,
  count?: number,
): Promise<RespLmpop | null> {
  return await executeCommand(
    this,
    createCommand(keys, direction, count),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (Array.isArray(reply) && reply.length === 2) {
        const [key, elements] = reply;
        if (
          (typeof key === 'string' || key instanceof Buffer) &&
          Array.isArray(elements)
        ) {
          return {
            key: `${key}`,
            elements: tryReplyToStringArray(elements, command),
          };
        }
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}

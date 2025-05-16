import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

import type { CommandLposOptions } from '../index.ts';

export function createCommand(
  key: string,
  element: string,
  options?: CommandLposOptions,
) {
  const command = ['LPOS', key, element];

  if (options) {
    if (options.rank !== undefined) {
      command.push('RANK', `${options.rank}`);
    }
    if (options.count !== undefined) {
      command.push('COUNT', `${options.count}`);
    }
    if (options.maxlen !== undefined) {
      command.push('MAXLEN', `${options.maxlen}`);
    }
  }

  return command;
}

export async function lpos<T>(
  this: T,
  key: string,
  element: string,
  options?: CommandLposOptions,
): Promise<number | number[] | null> {
  return await executeCommand(
    this,
    createCommand(key, element, options),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (typeof reply === 'number') {
        return reply;
      }

      return tryReplyToNumberArray(reply, command);
    },
  );
}

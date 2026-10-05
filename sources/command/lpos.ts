import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

import type { CommandLposOptions, StringOrBuffer } from '../index.ts';

export function createCommand(
  key: string,
  element: StringOrBuffer,
  options?: CommandLposOptions,
) {
  const command: StringOrBuffer[] = ['LPOS', key, element];

  if (options) {
    if (options.rank !== undefined) {
      command.push('RANK', formatInteger(options.rank));
    }
    if (options.count !== undefined) {
      command.push('COUNT', formatInteger(options.count));
    }
    if (options.maxlen !== undefined) {
      command.push('MAXLEN', formatInteger(options.maxlen));
    }
  }

  return command;
}

export async function lpos<T>(
  this: T,
  key: string,
  element: StringOrBuffer,
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

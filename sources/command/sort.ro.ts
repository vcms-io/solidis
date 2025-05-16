import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

import type { CommandSortOptions } from '../index.ts';

export function createCommand(key: string, options?: CommandSortOptions) {
  const command = ['SORT_RO', key];

  if (options) {
    if (options.by !== undefined) {
      command.push('BY', options.by);
    }

    if (options.limit) {
      command.push(
        'LIMIT',
        `${options.limit.offset}`,
        `${options.limit.count}`,
      );
    }

    if (options.get) {
      for (const pattern of options.get) {
        command.push('GET', pattern);
      }
    }

    if (options.order) {
      command.push(options.order);
    }

    if (options.alpha) {
      command.push('ALPHA');
    }
  }

  return command;
}

export async function sortRo<T>(
  this: T,
  key: string,
  options?: CommandSortOptions,
): Promise<string[]> {
  return await executeCommand(
    this,
    createCommand(key, options),
    tryReplyToStringArray,
  );
}

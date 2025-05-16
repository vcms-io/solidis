import {
  executeCommand,
  tryReplyToNumber,
  tryReplyToStringArray,
} from './utils/index.ts';

import type { CommandSortOptions, CommandSortStoreOptions } from '../index.ts';

export function createCommand(
  key: string,
  options?: CommandSortOptions | CommandSortStoreOptions,
) {
  const command = ['SORT', key];

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

    if ('store' in options) {
      command.push('STORE', options.store);
    }
  }

  return command;
}

export async function sort<T>(
  this: T,
  key: string,
  options?: CommandSortOptions,
): Promise<string[]>;
export async function sort<T>(
  this: T,
  key: string,
  options: CommandSortStoreOptions,
): Promise<number>;
export async function sort<T>(
  this: T,
  key: string,
  options?: CommandSortOptions | CommandSortStoreOptions,
): Promise<string[] | number> {
  return await executeCommand(
    this,
    createCommand(key, options),
    (reply, command) => {
      if (options && 'store' in options) {
        return tryReplyToNumber(reply, command);
      }

      return tryReplyToStringArray(reply, command);
    },
  );
}

import {
  buildSortCommand,
  executeCommand,
  tryReplyToNumber,
  tryReplyToStringArray,
} from './utils/index.ts';

import type { CommandSortOptions, CommandSortStoreOptions } from '../index.ts';

export function createCommand(
  key: string,
  options?: CommandSortOptions | CommandSortStoreOptions,
) {
  const command = buildSortCommand('SORT', key, options);

  if (options && 'store' in options) {
    command.push('STORE', options.store);
  }

  return command;
}

export async function sort<T>(
  this: T,
  key: string,
  options?: CommandSortOptions,
): Promise<(string | null)[]>;
export async function sort<T>(
  this: T,
  key: string,
  options: CommandSortStoreOptions,
): Promise<number>;
export async function sort<T>(
  this: T,
  key: string,
  options?: CommandSortOptions | CommandSortStoreOptions,
): Promise<(string | null)[] | number> {
  return await executeCommand(
    this,
    createCommand(key, options),
    (reply, command) => {
      if (options && 'store' in options) {
        return tryReplyToNumber(reply, command);
      }

      return tryReplyToStringArray(reply, command, true);
    },
  );
}

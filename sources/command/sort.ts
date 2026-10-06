import {
  buildSortCommand,
  executeCommand,
  tryReplyToNullableStringArray,
  tryReplyToNumber,
} from './utils/index.ts';

import type { CommandSortOptions, CommandSortStoreOptions } from '../index.ts';

export function createCommand(
  key: string,
  options?: CommandSortOptions | CommandSortStoreOptions,
) {
  const command = buildSortCommand('SORT', key, options);

  if (options?.store !== undefined) {
    command.push('STORE', options.store);
  }

  return command;
}

export async function sort<T>(
  this: T,
  key: string,
  options: CommandSortStoreOptions,
): Promise<number>;
export async function sort<T>(
  this: T,
  key: string,
  options?: CommandSortOptions,
): Promise<(string | null)[]>;
export async function sort<T>(
  this: T,
  key: string,
  options?: CommandSortOptions | CommandSortStoreOptions,
): Promise<(string | null)[] | number>;
export async function sort<T>(
  this: T,
  key: string,
  options?: CommandSortOptions | CommandSortStoreOptions,
): Promise<(string | null)[] | number> {
  return await executeCommand<T, (string | null)[] | number>(
    this,
    createCommand(key, options),
    options?.store === undefined
      ? tryReplyToNullableStringArray
      : tryReplyToNumber,
  );
}

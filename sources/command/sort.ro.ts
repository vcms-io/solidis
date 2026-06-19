import {
  buildSortCommand,
  executeCommand,
  tryReplyToNullableStringArray,
} from './utils/index.ts';

import type { CommandSortOptions } from '../index.ts';

export function createCommand(key: string, options?: CommandSortOptions) {
  return buildSortCommand('SORT_RO', key, options);
}

export async function sortRo<T>(
  this: T,
  key: string,
  options?: CommandSortOptions,
): Promise<(string | null)[]> {
  return await executeCommand(
    this,
    createCommand(key, options),
    tryReplyToNullableStringArray,
  );
}

import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

import type { CommandBloomFilterInsertOptions } from '../index.ts';

export function createCommand(
  key: string,
  items: string[],
  options?: CommandBloomFilterInsertOptions,
) {
  const command = ['BF.INSERT', key];

  if (options) {
    if (options.capacity !== undefined) {
      command.push('CAPACITY', `${options.capacity}`);
    }

    if (options.error !== undefined) {
      command.push('ERROR', `${options.error}`);
    }

    if (options.expansion !== undefined) {
      command.push('EXPANSION', `${options.expansion}`);
    }

    if (options.nonScaling) {
      command.push('NONSCALING');
    }

    if (options.nocreate) {
      command.push('NOCREATE');
    }
  }

  command.push('ITEMS', ...items);

  return command;
}

export async function bfInsert<T>(
  this: T,
  key: string,
  items: string[],
  options?: CommandBloomFilterInsertOptions,
): Promise<number[]> {
  return await executeCommand(
    this,
    createCommand(key, items, options),
    tryReplyToNumberArray,
  );
}

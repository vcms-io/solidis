import { formatInteger } from '../common/utils/internal.ts';
import {
  executeCommand,
  tryReplyToBoolean,
  tryReplyToValueOrErrorArray,
} from './utils/index.ts';

import type { CommandBloomFilterInsertOptions, RespError } from '../index.ts';

export function createCommand(
  key: string,
  items: string[],
  options?: CommandBloomFilterInsertOptions,
) {
  const command = ['BF.INSERT', key];

  if (options) {
    if (options.capacity !== undefined) {
      command.push('CAPACITY', formatInteger(options.capacity));
    }

    if (options.error !== undefined) {
      command.push('ERROR', `${options.error}`);
    }

    if (options.expansion !== undefined) {
      command.push('EXPANSION', formatInteger(options.expansion));
    }

    if (options.nonScaling) {
      command.push('NONSCALING');
    }

    if (options.nocreate) {
      command.push('NOCREATE');
    }
  }

  return [...command, 'ITEMS', ...items];
}

export async function bfInsert<T>(
  this: T,
  key: string,
  items: string[],
  options?: CommandBloomFilterInsertOptions,
): Promise<(boolean | RespError)[]> {
  const count = items.length;

  return await executeCommand(
    this,
    createCommand(key, items, options),
    (reply, command) =>
      tryReplyToValueOrErrorArray(reply, command, count, tryReplyToBoolean),
  );
}

import {
  buildSortedSetRangeStoreCommand,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

import type { CommandZRangeStoreOptions } from '../index.ts';

export function createCommand(
  destination: string,
  source: string,
  min: string,
  max: string,
  options: CommandZRangeStoreOptions,
) {
  return buildSortedSetRangeStoreCommand(
    ['ZRANGESTORE', destination, source, min, max],
    options,
  );
}

export async function zrangestore<T>(
  this: T,
  destination: string,
  source: string,
  min: string,
  max: string,
  options: CommandZRangeStoreOptions = {},
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(destination, source, min, max, options),
    tryReplyNumber,
  );
}

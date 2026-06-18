import {
  buildScanCommand,
  createScanIterator,
  tryReplyToStringArray,
} from './utils/index.ts';

import type { CommandScanBaseOptions } from '../index.ts';

export function createCommand(
  key: string,
  cursor: string,
  options: CommandScanBaseOptions,
) {
  return buildScanCommand(['SSCAN', key], cursor, options);
}

export async function* sscan<T>(
  this: T,
  key: string,
  options: CommandScanBaseOptions = {},
): AsyncGenerator<string[]> {
  yield* createScanIterator(
    this,
    ['SSCAN', key],
    options,
    tryReplyToStringArray,
  );
}

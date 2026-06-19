import { createScanIterator, tryReplyToStringArray } from './utils/index.ts';

import type { CommandScanBaseOptions } from '../index.ts';

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

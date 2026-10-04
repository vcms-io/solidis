import { createScanIterator, tryReplyToStringArray } from './utils/index.ts';

import type { CommandScanBaseOptions } from '../index.ts';

export function sscan<T>(
  this: T,
  key: string,
  options: CommandScanBaseOptions = {},
): AsyncGenerator<string[]> {
  return createScanIterator(
    this,
    ['SSCAN', key],
    { ...options },
    tryReplyToStringArray,
  );
}

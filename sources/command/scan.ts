import { createScanIterator, tryReplyToStringArray } from './utils/index.ts';

import type { CommandScanOptions } from '../index.ts';

export function scan<T>(
  this: T,
  options: CommandScanOptions = {},
): AsyncGenerator<string[]> {
  return createScanIterator(
    this,
    ['SCAN'],
    { ...options },
    tryReplyToStringArray,
  );
}

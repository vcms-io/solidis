import { createScanIterator, tryReplyToStringArray } from './utils/index.ts';

import type { CommandScanOptions } from '../index.ts';

export async function* scan<T>(
  this: T,
  options: CommandScanOptions = {},
): AsyncGenerator<string[]> {
  yield* createScanIterator(this, ['SCAN'], options, tryReplyToStringArray);
}

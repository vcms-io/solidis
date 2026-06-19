import { createScanIterator, tryReplyToStringRecord } from './utils/index.ts';

import type { CommandScanBaseOptions, RespHashField } from '../index.ts';

export async function* hscan<T>(
  this: T,
  key: string,
  options: CommandScanBaseOptions = {},
): AsyncGenerator<RespHashField> {
  yield* createScanIterator(
    this,
    ['HSCAN', key],
    options,
    tryReplyToStringRecord,
  );
}

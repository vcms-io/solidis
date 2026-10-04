import { createScanIterator, tryReplyToStringRecord } from './utils/index.ts';

import type { CommandScanBaseOptions, RespHashField } from '../index.ts';

export function hscan<T>(
  this: T,
  key: string,
  options: CommandScanBaseOptions = {},
): AsyncGenerator<RespHashField> {
  return createScanIterator(
    this,
    ['HSCAN', key],
    { ...options },
    tryReplyToStringRecord,
  );
}

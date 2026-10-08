import {
  createScanIterator,
  tryReplyToSortedSetMembers,
} from './utils/index.ts';

import type { CommandScanBaseOptions, RespSortedSetMember } from '../index.ts';

export function zscan<T>(
  this: T,
  key: string,
  options: CommandScanBaseOptions = {},
): AsyncGenerator<RespSortedSetMember[]> {
  return createScanIterator(
    this,
    ['ZSCAN', key],
    options,
    tryReplyToSortedSetMembers,
  );
}

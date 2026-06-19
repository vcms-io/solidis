import {
  createScanIterator,
  tryReplyToSortedSetMembers,
} from './utils/index.ts';

import type { CommandScanBaseOptions, RespSortedSetMember } from '../index.ts';

export async function* zscan<T>(
  this: T,
  key: string,
  options: CommandScanBaseOptions = {},
): AsyncGenerator<RespSortedSetMember[]> {
  yield* createScanIterator(
    this,
    ['ZSCAN', key],
    options,
    tryReplyToSortedSetMembers,
  );
}

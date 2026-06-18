import {
  buildScanCommand,
  createScanIterator,
  tryReplyToSortedSetMembers,
} from './utils/index.ts';

import type { CommandScanBaseOptions, RespSortedSetMember } from '../index.ts';

export function createCommand(
  key: string,
  cursor: string,
  options: CommandScanBaseOptions = {},
) {
  return buildScanCommand(['ZSCAN', key], cursor, options);
}

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

import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyToSortedSetMembers } from './utils/index.ts';

import type { RespSortedSetMember } from '../index.ts';

export function createCommand(key: string, count?: number) {
  const command = ['ZPOPMAX', key];

  if (count !== undefined) {
    command.push(formatInteger(count));
  }

  return command;
}

export async function zpopmax<T>(
  this: T,
  key: string,
  count?: number,
): Promise<RespSortedSetMember[]> {
  return await executeCommand(
    this,
    createCommand(key, count),
    tryReplyToSortedSetMembers,
  );
}

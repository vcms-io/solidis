import {
  executeCommand,
  tryReplyToKeySortedSetMembersOrNull,
} from './utils/index.ts';

import type { CommandMinOrMaxOption, RespSortedSetMember } from '../index.ts';

export function createCommand(
  keys: string[],
  where: CommandMinOrMaxOption,
  count?: number,
) {
  const command = ['ZMPOP', `${keys.length}`, ...keys, where];

  if (count !== undefined) {
    command.push('COUNT', `${count}`);
  }

  return command;
}

export async function zmpop<T>(
  this: T,
  keys: string[],
  where: CommandMinOrMaxOption,
  count?: number,
): Promise<{
  key: string;
  elements: RespSortedSetMember[];
} | null> {
  return await executeCommand(
    this,
    createCommand(keys, where, count),
    tryReplyToKeySortedSetMembersOrNull,
  );
}

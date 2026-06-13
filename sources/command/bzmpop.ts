import {
  executeCommand,
  tryReplyToKeyElementsOrNull,
  tryReplyToSortedSetMembers,
} from './utils/index.ts';

import type { CommandMinOrMaxOption, RespSortedSetMember } from '../index.ts';

export function createCommand(
  timeout: number,
  keys: string[],
  where: CommandMinOrMaxOption,
  count?: number,
) {
  const command = ['BZMPOP', `${timeout}`, `${keys.length}`, ...keys, where];

  if (count !== undefined) {
    command.push('COUNT', `${count}`);
  }

  return command;
}

export async function bzmpop<T>(
  this: T,
  timeout: number,
  keys: string[],
  where: CommandMinOrMaxOption,
  count?: number,
): Promise<{
  key: string;
  elements: RespSortedSetMember[];
} | null> {
  return await executeCommand(
    this,
    createCommand(timeout, keys, where, count),
    (reply, command) =>
      tryReplyToKeyElementsOrNull(reply, command, tryReplyToSortedSetMembers),
  );
}

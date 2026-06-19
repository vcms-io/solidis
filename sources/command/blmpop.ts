import {
  executeCommand,
  tryReplyToKeyStringElementsOrNull,
} from './utils/index.ts';

import type { CommandLeftOrRightOption, RespListMember } from '../index.ts';

export function createCommand(
  timeout: number,
  keys: string[],
  where: CommandLeftOrRightOption,
  count?: number,
) {
  const command = ['BLMPOP', `${timeout}`, `${keys.length}`, ...keys, where];

  if (count !== undefined) {
    command.push('COUNT', `${count}`);
  }

  return command;
}

export async function blmpop<T>(
  this: T,
  timeout: number,
  keys: string[],
  where: CommandLeftOrRightOption,
  count?: number,
): Promise<{
  key: string;
  elements: RespListMember[];
} | null> {
  return await executeCommand(
    this,
    createCommand(timeout, keys, where, count),
    tryReplyToKeyStringElementsOrNull,
  );
}

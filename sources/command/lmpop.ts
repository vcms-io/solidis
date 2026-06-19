import {
  executeCommand,
  tryReplyToKeyStringElementsOrNull,
} from './utils/index.ts';

import type { CommandLeftOrRightOption, RespLmpop } from '../index.ts';

export function createCommand(
  keys: string[],
  direction: CommandLeftOrRightOption,
  count?: number,
) {
  const command = ['LMPOP', `${keys.length}`, ...keys, direction];

  if (count !== undefined) {
    command.push('COUNT', `${count}`);
  }

  return command;
}

export async function lmpop<T>(
  this: T,
  keys: string[],
  direction: CommandLeftOrRightOption,
  count?: number,
): Promise<RespLmpop | null> {
  return await executeCommand(
    this,
    createCommand(keys, direction, count),
    tryReplyToKeyStringElementsOrNull,
  );
}

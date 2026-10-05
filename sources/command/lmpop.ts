import { formatInteger } from '../common/utils/internal.ts';
import {
  executeCommand,
  tryReplyToKeyStringElementsOrNull,
} from './utils/index.ts';

import type {
  CommandBufferOptions,
  CommandLeftOrRightOption,
  RespLmpop,
  RespString,
} from '../index.ts';

export function createCommand(
  keys: string[],
  direction: CommandLeftOrRightOption,
  count?: number,
) {
  const command = ['LMPOP', `${keys.length}`, ...keys, direction];

  if (count !== undefined) {
    command.push('COUNT', formatInteger(count));
  }

  return command;
}

export async function lmpop<
  T,
  Options extends CommandBufferOptions | undefined = undefined,
>(
  this: T,
  keys: string[],
  direction: CommandLeftOrRightOption,
  count?: number,
  options?: Options,
): Promise<RespLmpop<RespString<Options>> | null> {
  return await executeCommand(
    this,
    createCommand(keys, direction, count),
    tryReplyToKeyStringElementsOrNull,
    options,
  );
}

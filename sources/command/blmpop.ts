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

export async function blmpop<
  T,
  Options extends CommandBufferOptions | undefined = undefined,
>(
  this: T,
  timeout: number,
  keys: string[],
  where: CommandLeftOrRightOption,
  count?: number,
  options?: Options,
): Promise<RespLmpop<RespString<Options>> | null> {
  return await executeCommand(
    this,
    createCommand(timeout, keys, where, count),
    tryReplyToKeyStringElementsOrNull,
    options,
    { blockingTimeout: timeout * 1000 },
  );
}

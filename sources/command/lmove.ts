import {
  executeCommand,
  tryReplyToStringOrBufferOrNull,
} from './utils/index.ts';

import type {
  CommandBufferOptions,
  CommandLeftOrRightOption,
  RespString,
} from '../index.ts';

export function createCommand(
  source: string,
  destination: string,
  wherefrom: CommandLeftOrRightOption,
  whereto: CommandLeftOrRightOption,
) {
  return ['LMOVE', source, destination, wherefrom, whereto];
}

export async function lmove<
  T,
  Options extends CommandBufferOptions | undefined = undefined,
>(
  this: T,
  source: string,
  destination: string,
  wherefrom: CommandLeftOrRightOption,
  whereto: CommandLeftOrRightOption,
  options?: Options,
): Promise<RespString<Options> | null> {
  return await executeCommand(
    this,
    createCommand(source, destination, wherefrom, whereto),
    tryReplyToStringOrBufferOrNull,
    options,
  );
}

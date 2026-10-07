import {
  executeCommand,
  formatBlockingTimeout,
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
  whereFrom: CommandLeftOrRightOption,
  whereTo: CommandLeftOrRightOption,
  timeout: number,
) {
  return [
    'BLMOVE',
    source,
    destination,
    whereFrom,
    whereTo,
    formatBlockingTimeout(timeout),
  ];
}

export async function blmove<
  T,
  Options extends CommandBufferOptions | undefined = undefined,
>(
  this: T,
  source: string,
  destination: string,
  whereFrom: CommandLeftOrRightOption,
  whereTo: CommandLeftOrRightOption,
  timeout: number,
  options?: Options,
): Promise<RespString<Options> | null> {
  return await executeCommand(
    this,
    createCommand(source, destination, whereFrom, whereTo, timeout),
    tryReplyToStringOrBufferOrNull,
    options,
    { blockingTimeout: timeout * 1000 },
  );
}

import {
  executeCommand,
  tryReplyToStringOrBufferOrNull,
} from './utils/index.ts';

import type { CommandBufferOptions, RespString } from '../index.ts';

export function createCommand(key: string, index: number) {
  return ['LINDEX', key, `${index}`];
}

export async function lindex<
  T,
  Options extends CommandBufferOptions | undefined = undefined,
>(
  this: T,
  key: string,
  index: number,
  options?: Options,
): Promise<RespString<Options> | null> {
  return await executeCommand(
    this,
    createCommand(key, index),
    (reply, command) => tryReplyToStringOrBufferOrNull(reply, command, options),
  );
}

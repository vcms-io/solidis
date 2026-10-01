import {
  executeCommand,
  tryReplyToStringOrBufferOrNull,
} from './utils/index.ts';

import type { CommandBufferOptions, RespString } from '../index.ts';

export function createCommand(key: string, field: string) {
  return ['HGET', key, field];
}

export async function hget<
  T,
  Options extends CommandBufferOptions | undefined = undefined,
>(
  this: T,
  key: string,
  field: string,
  options?: Options,
): Promise<RespString<Options> | null> {
  return await executeCommand(
    this,
    createCommand(key, field),
    (reply, command) => tryReplyToStringOrBufferOrNull(reply, command, options),
  );
}

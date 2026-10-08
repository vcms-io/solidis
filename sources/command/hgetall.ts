import {
  executeCommand,
  tryReplyToStringOrBufferRecord,
} from './utils/index.ts';

import type { CommandBufferOptions, RespString } from '../index.ts';

export function createCommand(key: string) {
  return ['HGETALL', key];
}

export async function hgetall<
  T,
  Options extends CommandBufferOptions | undefined = undefined,
>(
  this: T,
  key: string,
  options?: Options,
): Promise<Record<string, RespString<Options>>> {
  return await executeCommand(
    this,
    createCommand(key),
    tryReplyToStringOrBufferRecord,
    options,
  );
}

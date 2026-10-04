import {
  executeCommand,
  tryReplyToStringOrBufferArray,
} from './utils/index.ts';

import type { CommandBufferOptions, RespString } from '../index.ts';

export function createCommand(key: string, start: number, stop: number) {
  return ['LRANGE', key, `${start}`, `${stop}`];
}

export async function lrange<
  T,
  Options extends CommandBufferOptions | undefined = undefined,
>(
  this: T,
  key: string,
  start: number,
  stop: number,
  options?: Options,
): Promise<RespString<Options>[]> {
  return await executeCommand(
    this,
    createCommand(key, start, stop),
    tryReplyToStringOrBufferArray,
    options,
  );
}

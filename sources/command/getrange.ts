import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyToStringOrBuffer } from './utils/index.ts';

import type { CommandBufferOptions, RespString } from '../index.ts';

export function createCommand(key: string, start: number, end: number) {
  return ['GETRANGE', key, formatInteger(start), formatInteger(end)];
}

export async function getrange<
  T,
  Options extends CommandBufferOptions | undefined = undefined,
>(
  this: T,
  key: string,
  start: number,
  end: number,
  options?: Options,
): Promise<RespString<Options>> {
  return await executeCommand(
    this,
    createCommand(key, start, end),
    tryReplyToStringOrBuffer,
    options,
  );
}

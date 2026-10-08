import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(channel: string, message: StringOrBuffer) {
  return ['SPUBLISH', channel, message];
}

export async function spublish<T>(
  this: T,
  channel: string,
  message: StringOrBuffer,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(channel, message),
    tryReplyNumber,
  );
}

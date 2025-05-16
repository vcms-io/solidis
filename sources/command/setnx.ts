import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(key: string, value: StringOrBuffer) {
  return ['SETNX', key, value];
}

export async function setnx<T>(
  this: T,
  key: string,
  value: StringOrBuffer,
): Promise<number> {
  return await executeCommand(this, createCommand(key, value), tryReplyNumber);
}

import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(
  key: string,
  seconds: number,
  value: StringOrBuffer,
) {
  return ['SETEX', key, `${seconds}`, value];
}

export async function setex<T>(
  this: T,
  key: string,
  seconds: number,
  value: StringOrBuffer,
) {
  return await executeCommand(
    this,
    createCommand(key, seconds, value),
    tryReplyOK,
  );
}

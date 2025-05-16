import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(
  key: string,
  milliseconds: number,
  value: StringOrBuffer,
) {
  return ['PSETEX', key, `${milliseconds}`, value];
}

export async function psetex<T>(
  this: T,
  key: string,
  milliseconds: number,
  value: StringOrBuffer,
) {
  return await executeCommand(
    this,
    createCommand(key, milliseconds, value),
    tryReplyOK,
  );
}

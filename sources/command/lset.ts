import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(
  key: string,
  index: number,
  element: StringOrBuffer,
) {
  return ['LSET', key, `${index}`, element];
}

export async function lset<T>(
  this: T,
  key: string,
  index: number,
  element: StringOrBuffer,
) {
  return await executeCommand(
    this,
    createCommand(key, index, element),
    tryReplyOK,
  );
}

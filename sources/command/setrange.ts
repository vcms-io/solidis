import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(
  key: string,
  offset: number,
  value: StringOrBuffer,
) {
  return ['SETRANGE', key, `${offset}`, value];
}

export async function setrange<T>(
  this: T,
  key: string,
  offset: number,
  value: StringOrBuffer,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, offset, value),
    tryReplyNumber,
  );
}

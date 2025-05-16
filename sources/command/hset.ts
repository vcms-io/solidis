import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(
  key: string,
  field: string,
  value: StringOrBuffer,
) {
  return ['HSET', key, field, value];
}

export async function hset<T>(
  this: T,
  key: string,
  field: string,
  value: StringOrBuffer,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, field, value),
    tryReplyNumber,
  );
}

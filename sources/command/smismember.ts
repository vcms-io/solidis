import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(key: string, members: StringOrBuffer[]) {
  return ['SMISMEMBER', key, ...members];
}

export async function smismember<T>(
  this: T,
  key: string,
  members: StringOrBuffer[],
): Promise<number[]> {
  return await executeCommand(
    this,
    createCommand(key, members),
    tryReplyToNumberArray,
  );
}

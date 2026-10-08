import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(key: string, value: StringOrBuffer) {
  return ['APPEND', key, value];
}

export async function append<T>(this: T, key: string, value: StringOrBuffer) {
  return await executeCommand(this, createCommand(key, value), tryReplyNumber);
}

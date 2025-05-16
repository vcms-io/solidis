import { executeCommand, tryReplyToStringRecord } from './utils/index.ts';

import type { RespHashField } from '../index.ts';

export function createCommand(key: string) {
  return ['HGETALL', key];
}

export async function hgetall<T>(this: T, key: string): Promise<RespHashField> {
  return await executeCommand(this, createCommand(key), tryReplyToStringRecord);
}

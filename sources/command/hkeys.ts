import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(key: string) {
  return ['HKEYS', key];
}

export async function hkeys<T>(this: T, key: string): Promise<string[]> {
  return await executeCommand(this, createCommand(key), tryReplyToStringArray);
}

import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(key: string) {
  return ['SMEMBERS', key];
}

export async function smembers<T>(this: T, key: string): Promise<string[]> {
  return await executeCommand(this, createCommand(key), tryReplyToStringArray);
}

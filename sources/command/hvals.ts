import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(key: string) {
  return ['HVALS', key];
}

export async function hvals<T>(this: T, key: string): Promise<string[]> {
  return await executeCommand(this, createCommand(key), tryReplyToStringArray);
}

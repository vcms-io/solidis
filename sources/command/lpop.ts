import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

export function createCommand(key: string) {
  return ['LPOP', key];
}

export async function lpop<T>(this: T, key: string): Promise<string | null> {
  return await executeCommand(this, createCommand(key), tryReplyToStringOrNull);
}

import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

export function createCommand(key: string) {
  return ['GETDEL', key];
}

export async function getdel<T>(this: T, key: string): Promise<string | null> {
  return await executeCommand(this, createCommand(key), tryReplyToStringOrNull);
}

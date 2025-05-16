import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

export function createCommand(key: string) {
  return ['GET', key];
}

export async function get<T>(this: T, key: string): Promise<string | null> {
  return await executeCommand(this, createCommand(key), tryReplyToStringOrNull);
}

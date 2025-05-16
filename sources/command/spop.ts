import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

export function createCommand(key: string) {
  return ['SPOP', key];
}

export async function spop<T>(this: T, key: string): Promise<string | null> {
  return await executeCommand(this, createCommand(key), tryReplyToStringOrNull);
}

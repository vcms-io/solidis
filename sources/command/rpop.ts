import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

export function createCommand(key: string) {
  return ['RPOP', key];
}

export async function rpop<T>(this: T, key: string): Promise<string | null> {
  return await executeCommand(this, createCommand(key), tryReplyToStringOrNull);
}

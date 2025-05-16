import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(pattern: string) {
  return ['KEYS', pattern];
}

export async function keys<T>(this: T, pattern: string): Promise<string[]> {
  return await executeCommand(
    this,
    createCommand(pattern),
    tryReplyToStringArray,
  );
}

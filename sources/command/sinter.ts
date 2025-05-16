import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(...keys: string[]) {
  return ['SINTER', ...keys];
}

export async function sinter<T>(this: T, ...keys: string[]): Promise<string[]> {
  return await executeCommand(
    this,
    createCommand(...keys),
    tryReplyToStringArray,
  );
}

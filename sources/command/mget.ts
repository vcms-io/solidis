import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(...keys: string[]) {
  return ['MGET', ...keys];
}

export async function mget<T>(
  this: T,
  ...keys: string[]
): Promise<(string | null)[]> {
  return await executeCommand(
    this,
    createCommand(...keys),
    tryReplyToStringArray,
  );
}

import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

export function createCommand(sha1s: string[]) {
  return ['SCRIPT', 'EXISTS', ...sha1s];
}

export async function scriptExists<T>(
  this: T,
  sha1s: string[],
): Promise<number[]> {
  return await executeCommand(
    this,
    createCommand(sha1s),
    tryReplyToNumberArray,
  );
}

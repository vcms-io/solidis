import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

export function createCommand(key: string, items: string[]) {
  return ['BF.MADD', key, ...items];
}

export async function bfMadd<T>(
  this: T,
  key: string,
  items: string[],
): Promise<number[]> {
  return await executeCommand(
    this,
    createCommand(key, items),
    tryReplyToNumberArray,
  );
}

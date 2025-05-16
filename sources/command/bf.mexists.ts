import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

export function createCommand(key: string, items: string[]) {
  return ['BF.MEXISTS', key, ...items];
}

export async function bfMexists<T>(
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

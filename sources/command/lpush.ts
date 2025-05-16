import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, ...elements: string[]) {
  return ['LPUSH', key, ...elements];
}

export async function lpush<T>(
  this: T,
  key: string,
  ...elements: string[]
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, ...elements),
    tryReplyNumber,
  );
}

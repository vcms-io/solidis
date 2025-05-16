import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, min: string, max: string) {
  return ['ZLEXCOUNT', key, min, max];
}

export async function zlexcount<T>(
  this: T,
  key: string,
  min: string,
  max: string,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, min, max),
    tryReplyNumber,
  );
}

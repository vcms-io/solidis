import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, item: string) {
  return ['CF.COUNT', key, item];
}

export async function cfCount<T>(
  this: T,
  key: string,
  item: string,
): Promise<number> {
  return await executeCommand(this, createCommand(key, item), tryReplyNumber);
}

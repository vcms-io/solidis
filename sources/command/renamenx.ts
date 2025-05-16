import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, newkey: string) {
  return ['RENAMENX', key, newkey];
}

export async function renamenx<T>(
  this: T,
  key: string,
  newkey: string,
): Promise<number> {
  return await executeCommand(this, createCommand(key, newkey), tryReplyNumber);
}

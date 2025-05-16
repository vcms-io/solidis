import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string) {
  return ['INCR', key];
}

export async function incr<T>(this: T, key: string): Promise<number> {
  return await executeCommand(this, createCommand(key), tryReplyNumber);
}

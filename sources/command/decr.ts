import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string) {
  return ['DECR', key];
}

export async function decr<T>(this: T, key: string): Promise<number> {
  return await executeCommand(this, createCommand(key), tryReplyNumber);
}

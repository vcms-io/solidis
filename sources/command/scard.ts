import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string) {
  return ['SCARD', key];
}

export async function scard<T>(this: T, key: string): Promise<number> {
  return await executeCommand(this, createCommand(key), tryReplyNumber);
}

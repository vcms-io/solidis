import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string) {
  return ['HLEN', key];
}

export async function hlen<T>(this: T, key: string): Promise<number> {
  return await executeCommand(this, createCommand(key), tryReplyNumber);
}

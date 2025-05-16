import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string) {
  return ['LLEN', key];
}

export async function llen<T>(this: T, key: string): Promise<number> {
  return await executeCommand(this, createCommand(key), tryReplyNumber);
}

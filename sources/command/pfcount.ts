import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(keys: string[]) {
  return ['PFCOUNT', ...keys];
}

export async function pfcount<T>(this: T, keys: string[]): Promise<number> {
  return await executeCommand(this, createCommand(keys), tryReplyNumber);
}

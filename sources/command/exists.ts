import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(...keys: string[]) {
  return ['EXISTS', ...keys];
}

export async function exists<T>(this: T, ...keys: string[]): Promise<number> {
  return await executeCommand(this, createCommand(...keys), tryReplyNumber);
}

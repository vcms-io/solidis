import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(keys: string[]) {
  return ['UNLINK', ...keys];
}

export async function unlink<T>(this: T, keys: string[]): Promise<number> {
  return await executeCommand(this, createCommand(keys), tryReplyNumber);
}

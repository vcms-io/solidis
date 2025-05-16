import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(keys: string[]) {
  return ['TOUCH', ...keys];
}

export async function touch<T>(this: T, keys: string[]): Promise<number> {
  return await executeCommand(this, createCommand(keys), tryReplyNumber);
}

import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(...keys: string[]) {
  return ['DEL', ...keys];
}

export async function del<T>(this: T, ...keys: string[]): Promise<number> {
  return await executeCommand(this, createCommand(...keys), tryReplyNumber);
}

import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(...keys: string[]) {
  return ['WATCH', ...keys];
}

export async function watch<T>(this: T, ...keys: string[]) {
  return await executeCommand(this, createCommand(...keys), tryReplyOK);
}

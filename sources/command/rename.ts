import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(key: string, newkey: string) {
  return ['RENAME', key, newkey];
}

export async function rename<T>(this: T, key: string, newkey: string) {
  return await executeCommand(this, createCommand(key, newkey), tryReplyOK);
}

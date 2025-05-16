import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand() {
  return ['BGREWRITEAOF'];
}

export async function bgrewriteaof<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyOK);
}

import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand() {
  return ['UNWATCH'];
}

export async function unwatch<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyOK);
}

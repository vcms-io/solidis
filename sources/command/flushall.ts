import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand() {
  return ['FLUSHALL'];
}

export async function flushall<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyOK);
}

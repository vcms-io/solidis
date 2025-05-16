import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand() {
  return ['FLUSHDB'];
}

export async function flushdb<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyOK);
}

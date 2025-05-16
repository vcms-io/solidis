import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand() {
  return ['MEMORY', 'PURGE'];
}

export async function memoryPurge<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyOK);
}

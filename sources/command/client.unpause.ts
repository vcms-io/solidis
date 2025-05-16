import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand() {
  return ['CLIENT', 'UNPAUSE'];
}

export async function clientUnpause<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyOK);
}

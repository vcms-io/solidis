import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand() {
  return ['RESET'];
}

export async function reset<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyOK);
}

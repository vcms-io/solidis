import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand() {
  return ['SLOWLOG', 'RESET'];
}

export async function slowlogReset<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyOK);
}

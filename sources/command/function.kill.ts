import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand() {
  return ['FUNCTION', 'KILL'];
}

export async function functionKill<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyOK);
}

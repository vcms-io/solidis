import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand() {
  return ['SCRIPT', 'KILL'];
}

export async function scriptKill<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyOK);
}

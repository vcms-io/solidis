import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand() {
  return ['SAVE'];
}

export async function save<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyOK);
}

import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand() {
  return ['ACL', 'SAVE'];
}

export async function aclSave<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyOK);
}

import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand() {
  return ['ACL', 'WHOAMI'];
}

export async function aclWhoami<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyToString);
}

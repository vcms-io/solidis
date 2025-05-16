import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['ACL', 'USERS'];
}

export async function aclUsers<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

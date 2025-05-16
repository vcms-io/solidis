import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['ACL', 'LIST'];
}

export async function aclList<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

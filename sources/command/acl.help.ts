import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['ACL', 'HELP'];
}

export async function aclHelp<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

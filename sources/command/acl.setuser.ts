import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(username: string, ...rules: string[]) {
  return ['ACL', 'SETUSER', username, ...rules];
}

export async function aclSetuser<T>(
  this: T,
  username: string,
  ...rules: string[]
) {
  return await executeCommand(
    this,
    createCommand(username, ...rules),
    tryReplyOK,
  );
}

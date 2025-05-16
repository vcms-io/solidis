import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand(
  username: string,
  command: string,
  parameters: string[],
) {
  return ['ACL', 'DRYRUN', username, command, ...parameters];
}

export async function aclDryrun<T>(
  this: T,
  username: string,
  command: string,
  parameters: string[],
) {
  return await executeCommand(
    this,
    createCommand(username, command, parameters),
    tryReplyToString,
  );
}

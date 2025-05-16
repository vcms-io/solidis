import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand(bits?: number) {
  const command = ['ACL', 'GENPASS'];

  if (bits) {
    command.push(`${bits}`);
  }

  return command;
}

export async function aclGenpass<T>(this: T, bits?: number) {
  return await executeCommand(this, createCommand(bits), tryReplyToString);
}

import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand(bits?: number) {
  const command = ['ACL', 'GENPASS'];

  if (bits !== undefined) {
    command.push(formatInteger(bits));
  }

  return command;
}

export async function aclGenpass<T>(this: T, bits?: number) {
  return await executeCommand(this, createCommand(bits), tryReplyToString);
}

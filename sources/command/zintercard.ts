import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(keys: string[], limit?: number) {
  const command = ['ZINTERCARD', `${keys.length}`, ...keys];

  if (limit !== undefined) {
    command.push('LIMIT', `${limit}`);
  }

  return command;
}

export async function zintercard<T>(
  this: T,
  keys: string[],
  limit?: number,
): Promise<number> {
  return await executeCommand(this, createCommand(keys, limit), tryReplyNumber);
}

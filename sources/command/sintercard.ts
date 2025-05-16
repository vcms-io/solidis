import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(keys: string[], limit?: number) {
  const command = ['SINTERCARD', `${keys.length}`, ...keys];

  if (limit !== undefined) {
    command.push('LIMIT', `${limit}`);
  }

  return command;
}

export async function sintercard<T>(
  this: T,
  keys: string[],
  limit?: number,
): Promise<number> {
  return await executeCommand(this, createCommand(keys, limit), tryReplyNumber);
}

import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { CommandExpireMode } from '../index.ts';

export function createCommand(
  key: string,
  seconds: number,
  mode?: CommandExpireMode,
) {
  const command = ['EXPIRE', key, `${seconds}`];

  if (mode) {
    command.push(mode);
  }

  return command;
}

export async function expire<T>(
  this: T,
  key: string,
  seconds: number,
  mode?: CommandExpireMode,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, seconds, mode),
    tryReplyNumber,
  );
}

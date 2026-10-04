import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { CommandKeyExpireMode } from '../index.ts';

export function createCommand(
  key: string,
  seconds: number,
  mode?: CommandKeyExpireMode,
) {
  const command = ['EXPIRE', key, `${seconds}`];

  if (mode) {
    command.push(...mode.split(' '));
  }

  return command;
}

export async function expire<T>(
  this: T,
  key: string,
  seconds: number,
  mode?: CommandKeyExpireMode,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, seconds, mode),
    tryReplyNumber,
  );
}

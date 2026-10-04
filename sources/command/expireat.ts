import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { CommandKeyExpireMode } from '../index.ts';

export function createCommand(
  key: string,
  timestamp: number,
  mode?: CommandKeyExpireMode,
) {
  const command = ['EXPIREAT', key, `${timestamp}`];

  if (mode) {
    command.push(...mode.split(' '));
  }

  return command;
}

export async function expireat<T>(
  this: T,
  key: string,
  timestamp: number,
  mode?: CommandKeyExpireMode,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, timestamp, mode),
    tryReplyNumber,
  );
}

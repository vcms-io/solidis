import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { CommandExpireMode } from '../index.ts';

export function createCommand(
  key: string,
  timestamp: number,
  mode?: CommandExpireMode,
) {
  const command = ['EXPIREAT', key, `${timestamp}`];

  if (mode) {
    command.push(mode);
  }

  return command;
}

export async function expireat<T>(
  this: T,
  key: string,
  timestamp: number,
  mode?: CommandExpireMode,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, timestamp, mode),
    tryReplyNumber,
  );
}

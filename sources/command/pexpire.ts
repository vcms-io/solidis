import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { CommandKeyExpireMode } from '../index.ts';

export function createCommand(
  key: string,
  milliseconds: number,
  mode?: CommandKeyExpireMode,
) {
  const command = ['PEXPIRE', key, `${milliseconds}`];

  if (mode) {
    command.push(...mode.split(' '));
  }

  return command;
}

export async function pexpire<T>(
  this: T,
  key: string,
  milliseconds: number,
  mode?: CommandKeyExpireMode,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, milliseconds, mode),
    tryReplyNumber,
  );
}

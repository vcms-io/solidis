import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { CommandExpireMode } from '../index.ts';

export function createCommand(
  key: string,
  milliseconds: number,
  mode?: CommandExpireMode,
) {
  const command = ['PEXPIRE', key, `${milliseconds}`];

  if (mode) {
    command.push(mode);
  }

  return command;
}

export async function pexpire<T>(
  this: T,
  key: string,
  milliseconds: number,
  mode?: CommandExpireMode,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, milliseconds, mode),
    tryReplyNumber,
  );
}

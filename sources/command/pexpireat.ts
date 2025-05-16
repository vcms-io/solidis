import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { CommandExpireMode } from '../index.ts';

export function createCommand(
  key: string,
  millisecondsTimestamp: number,
  mode?: CommandExpireMode,
) {
  const command = ['PEXPIREAT', key, `${millisecondsTimestamp}`];

  if (mode) {
    command.push(mode);
  }

  return command;
}

export async function pexpireat<T>(
  this: T,
  key: string,
  millisecondsTimestamp: number,
  mode?: CommandExpireMode,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, millisecondsTimestamp, mode),
    tryReplyNumber,
  );
}

import {
  buildKeyExpireCommand,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

import type { CommandKeyExpireMode } from '../index.ts';

export const createCommand = buildKeyExpireCommand('PEXPIREAT');

export async function pexpireat<T>(
  this: T,
  key: string,
  millisecondsTimestamp: number,
  mode?: CommandKeyExpireMode,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, millisecondsTimestamp, mode),
    tryReplyNumber,
  );
}

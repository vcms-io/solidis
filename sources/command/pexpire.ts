import {
  buildKeyExpireCommand,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

import type { CommandKeyExpireMode } from '../index.ts';

export const createCommand = buildKeyExpireCommand('PEXPIRE');

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

import {
  buildKeyExpireCommand,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

import type { CommandKeyExpireMode } from '../index.ts';

export const createCommand = buildKeyExpireCommand('EXPIRE');

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

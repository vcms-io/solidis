import {
  buildKeyExpireCommand,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

import type { CommandKeyExpireMode } from '../index.ts';

export const createCommand = buildKeyExpireCommand('EXPIREAT');

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

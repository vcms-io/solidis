import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { CommandClientUnblockOptions } from '../index.ts';

export function createCommand(
  clientId: number,
  options?: CommandClientUnblockOptions,
) {
  const command = ['CLIENT', 'UNBLOCK', `${clientId}`];

  if (options) {
    if (options.timeout) {
      command.push('TIMEOUT');
    }

    if (options.error) {
      command.push('ERROR');
    }
  }

  return command;
}

export async function clientUnblock<T>(
  this: T,
  clientId: number,
  options?: CommandClientUnblockOptions,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(clientId, options),
    tryReplyNumber,
  );
}

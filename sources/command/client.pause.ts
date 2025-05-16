import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { CommandClientPauseOptions } from '../index.ts';

export function createCommand(
  timeout: number,
  options?: CommandClientPauseOptions,
) {
  const command = ['CLIENT', 'PAUSE', `${timeout}`];

  if (options?.mode) {
    command.push(options.mode);
  }

  return command;
}

export async function clientPause<T>(
  this: T,
  timeout: number,
  options?: CommandClientPauseOptions,
) {
  return await executeCommand(
    this,
    createCommand(timeout, options),
    tryReplyOK,
  );
}

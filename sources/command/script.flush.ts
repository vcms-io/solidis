import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { CommandScriptFlushOptions } from '../index.ts';

export function createCommand(options?: CommandScriptFlushOptions) {
  const command = ['SCRIPT', 'FLUSH'];

  if (options?.sync) {
    command.push('SYNC');
  } else if (options?.async) {
    command.push('ASYNC');
  }

  return command;
}

export async function scriptFlush<T>(
  this: T,
  options?: CommandScriptFlushOptions,
) {
  return await executeCommand(this, createCommand(options), tryReplyOK);
}

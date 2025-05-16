import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { CommandFunctionRestoreOptions } from '../index.ts';

export function createCommand(
  dump: string,
  options?: CommandFunctionRestoreOptions,
) {
  const command = ['FUNCTION', 'RESTORE'];

  if (options?.replace) {
    command.push('REPLACE');
  }

  if (options?.flush) {
    command.push('FLUSH');
  }

  if (options?.append) {
    command.push('APPEND');
  }

  command.push(dump);

  return command;
}

export async function functionRestore<T>(
  this: T,
  dump: string,
  options?: CommandFunctionRestoreOptions,
) {
  return await executeCommand(this, createCommand(dump, options), tryReplyOK);
}

import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { CommandFunctionRestoreOptions } from '../index.ts';

export function createCommand(
  dump: string,
  options?: CommandFunctionRestoreOptions,
) {
  const command: (string | Buffer)[] = [
    'FUNCTION',
    'RESTORE',
    Buffer.from(dump, 'latin1'),
  ];

  if (options?.replace) {
    command.push('REPLACE');
  }

  if (options?.flush) {
    command.push('FLUSH');
  }

  if (options?.append) {
    command.push('APPEND');
  }

  return command;
}

export async function functionRestore<T>(
  this: T,
  dump: string,
  options?: CommandFunctionRestoreOptions,
) {
  return await executeCommand(this, createCommand(dump, options), tryReplyOK);
}

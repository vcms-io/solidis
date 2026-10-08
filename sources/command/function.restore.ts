import { toBinaryBuffer } from '../common/utils/internal.ts';
import { executeCommand, tryReplyOK } from './utils/index.ts';

import type {
  CommandFunctionRestoreOptions,
  StringOrBuffer,
} from '../index.ts';

export function createCommand(
  dump: StringOrBuffer,
  options?: CommandFunctionRestoreOptions,
) {
  const command: StringOrBuffer[] = [
    'FUNCTION',
    'RESTORE',
    toBinaryBuffer(dump),
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
  dump: StringOrBuffer,
  options?: CommandFunctionRestoreOptions,
) {
  return await executeCommand(this, createCommand(dump, options), tryReplyOK);
}

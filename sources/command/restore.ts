import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { CommandRestoreOptions, StringOrBuffer } from '../index.ts';

export function createCommand(
  key: string,
  ttl: number,
  serializedValue: StringOrBuffer,
  options?: CommandRestoreOptions,
) {
  const command: StringOrBuffer[] = ['RESTORE', key, `${ttl}`, serializedValue];

  if (options) {
    if (options.replace === true) {
      command.push('REPLACE');
    }

    if (options.absttl === true) {
      command.push('ABSTTL');
    }

    if (options.idletime !== undefined) {
      command.push('IDLETIME', `${options.idletime}`);
    }

    if (options.freq !== undefined) {
      command.push('FREQ', `${options.freq}`);
    }
  }

  return command;
}

export async function restore<T>(
  this: T,
  key: string,
  ttl: number,
  serializedValue: StringOrBuffer,
  options?: CommandRestoreOptions,
) {
  return await executeCommand(
    this,
    createCommand(key, ttl, serializedValue, options),
    tryReplyOK,
  );
}

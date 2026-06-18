import {
  appendExpireOptions,
  executeCommand,
  tryReplyToStringOrNull,
} from './utils/index.ts';

import type { CommandGetExOptions } from '../index.ts';

export function createCommand(key: string, options?: CommandGetExOptions) {
  const command = ['GETEX', key];

  if (options) {
    appendExpireOptions(command, options);

    if (options.persist === true) {
      command.push('PERSIST');
    }
  }

  return command;
}

export async function getex<T>(
  this: T,
  key: string,
  options?: CommandGetExOptions,
): Promise<string | null> {
  return await executeCommand(
    this,
    createCommand(key, options),
    tryReplyToStringOrNull,
  );
}

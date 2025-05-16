import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

import type { CommandGetExOptions } from '../index.ts';

export function createCommand(key: string, options?: CommandGetExOptions) {
  const command = ['GETEX', key];

  if (options) {
    if (options.expireInSeconds !== undefined) {
      command.push('EX', `${options.expireInSeconds}`);
    }

    if (options.expireInMilliseconds !== undefined) {
      command.push('PX', `${options.expireInMilliseconds}`);
    }

    if (options.expireAtSeconds !== undefined) {
      command.push('EXAT', `${options.expireAtSeconds}`);
    }

    if (options.expireAtMilliseconds !== undefined) {
      command.push('PXAT', `${options.expireAtMilliseconds}`);
    }

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

import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { CommandJsonSetOptions, RespOK } from '../index.ts';

export function createCommand(
  key: string,
  path: string,
  value: string,
  options?: CommandJsonSetOptions,
) {
  const command = ['JSON.SET', key, path, value];

  if (options) {
    if (options.nx) {
      command.push('NX');
    }

    if (options.xx) {
      command.push('XX');
    }
  }

  return command;
}

export async function jsonSet<T>(
  this: T,
  key: string,
  path: string,
  value: string,
  options?: CommandJsonSetOptions,
): Promise<RespOK | null> {
  return await executeCommand(
    this,
    createCommand(key, path, value, options),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      return tryReplyOK(reply, command);
    },
  );
}

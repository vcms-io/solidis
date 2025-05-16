import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

import type { CommandJsonArrIndexOptions } from '../index.ts';

export function createCommand(
  key: string,
  path: string,
  value: string,
  options?: CommandJsonArrIndexOptions,
) {
  const command = ['JSON.ARRINDEX', key, path, value];

  if (options?.start !== undefined) {
    command.push(`${options.start}`);

    if (options.stop !== undefined) {
      command.push(`${options.stop}`);
    }
  }

  return command;
}

export async function jsonArrindex<T>(
  this: T,
  key: string,
  path: string,
  value: string,
  options?: CommandJsonArrIndexOptions,
): Promise<(number | null)[]> {
  return await executeCommand(
    this,
    createCommand(key, path, value, options),
    (reply, command) => tryReplyToNumberArray(reply, command, true),
  );
}

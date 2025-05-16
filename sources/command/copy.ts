import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { CommandCopyOptions } from '../index.ts';

export function createCommand(
  source: string,
  destination: string,
  options?: CommandCopyOptions,
) {
  const command = ['COPY', source, destination];

  if (options?.destinationDatabase !== undefined) {
    command.push('DB', `${options.destinationDatabase}`);
  }

  if (options?.replace) {
    command.push('REPLACE');
  }

  return command;
}

export async function copy<T>(
  this: T,
  source: string,
  destination: string,
  options?: CommandCopyOptions,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(source, destination, options),
    tryReplyNumber,
  );
}

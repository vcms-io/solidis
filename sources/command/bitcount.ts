import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { CommandStartToEndAndBitOrByteOptions } from '../index.ts';

export function createCommand(
  key: string,
  options?: CommandStartToEndAndBitOrByteOptions,
) {
  const command = ['BITCOUNT', key];

  if (options?.start !== undefined && options?.end !== undefined) {
    command.push(`${options.start}`, `${options.end}`);

    if (options.mode) {
      command.push(options.mode);
    }
  }

  return command;
}

export async function bitcount<T>(
  this: T,
  key: string,
  options?: CommandStartToEndAndBitOrByteOptions,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, options),
    tryReplyNumber,
  );
}

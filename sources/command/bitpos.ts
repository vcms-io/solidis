import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type {
  CommandStartToEndAndBitOrByteOptions,
  RespBit,
} from '../index.ts';

export function createCommand(
  key: string,
  bit: RespBit,
  options?: CommandStartToEndAndBitOrByteOptions,
) {
  const command = ['BITPOS', key, `${bit}`];

  if (options?.start !== undefined) {
    command.push(`${options.start}`);

    if (options.end !== undefined) {
      command.push(`${options.end}`);

      if (options.mode) {
        command.push(options.mode);
      }
    }
  }

  return command;
}

export async function bitpos<T>(
  this: T,
  key: string,
  bit: RespBit,
  options?: CommandStartToEndAndBitOrByteOptions,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, bit, options),
    tryReplyNumber,
  );
}

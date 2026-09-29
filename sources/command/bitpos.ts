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

  const hasEnd = options?.end !== undefined || options?.mode !== undefined;

  if (options?.start !== undefined || hasEnd) {
    command.push(`${options?.start ?? 0}`);
  }

  if (hasEnd) {
    command.push(`${options?.end ?? -1}`);
  }

  if (options?.mode) {
    command.push(options.mode);
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

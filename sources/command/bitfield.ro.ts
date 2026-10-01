import {
  executeCommand,
  tryReplyArray,
  tryReplyToInteger,
} from './utils/index.ts';

import type {
  CommandBitfieldRoGetOperationOption,
  CommandIntegerOptions,
  RespInteger,
} from '../index.ts';

export function createCommand(
  key: string,
  operations: CommandBitfieldRoGetOperationOption[],
) {
  const command = ['BITFIELD_RO', key];

  for (const operation of operations) {
    command.push('GET', operation.type, `${operation.offset}`);
  }

  return command;
}

export async function bitfieldRo<
  T,
  Options extends CommandIntegerOptions | undefined = undefined,
>(
  this: T,
  key: string,
  operations: CommandBitfieldRoGetOperationOption[],
  options?: Options,
): Promise<RespInteger<Options>[]> {
  return await executeCommand(
    this,
    createCommand(key, operations),
    (reply, command) =>
      tryReplyArray(reply, command).map((value) =>
        tryReplyToInteger(value, command, options),
      ),
  );
}

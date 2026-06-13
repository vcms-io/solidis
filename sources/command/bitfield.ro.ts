import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

import type { CommandBitfieldRoGetOperationOption } from '../index.ts';

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

export async function bitfieldRo<T>(
  this: T,
  key: string,
  operations: CommandBitfieldRoGetOperationOption[],
): Promise<number[]> {
  return await executeCommand(
    this,
    createCommand(key, operations),
    tryReplyToNumberArray,
  );
}

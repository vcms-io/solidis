import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

import type { CommandBitfieldRoGetOperationOption } from '../index.ts';

export function createCommand(
  key: string,
  operations: CommandBitfieldRoGetOperationOption[],
) {
  const command = ['BITFIELD_RO', key];

  for (const op of operations) {
    command.push('GET', op.type, `${op.offset}`);
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

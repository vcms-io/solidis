import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

import type {
  CommandBitfieldOperationOption,
  RespBitfieldOverflow,
} from '../index.ts';

export function createCommand(
  key: string,
  operations: CommandBitfieldOperationOption[],
  overflow?: RespBitfieldOverflow,
) {
  const command = ['BITFIELD', key];

  if (overflow) {
    command.push('OVERFLOW', overflow);
  }

  for (const op of operations) {
    command.push(op.operation);
    command.push(op.type);
    command.push(`${op.offset}`);

    if (op.operation === 'SET') {
      command.push(`${op.value}`);
    } else if (op.operation === 'INCRBY') {
      command.push(`${op.increment}`);
    }
  }

  return command;
}

export async function bitfield<T>(
  this: T,
  key: string,
  operations: CommandBitfieldOperationOption[],
  overflow?: RespBitfieldOverflow,
): Promise<number[] | null> {
  return await executeCommand(
    this,
    createCommand(key, operations, overflow),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      return tryReplyToNumberArray(reply, command);
    },
  );
}

import {
  executeCommand,
  tryReplyArray,
  tryReplyToInteger,
} from './utils/index.ts';

import type {
  CommandBitfieldOperationOption,
  RespBitfieldOverflow,
  SolidisInteger,
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

  for (const operation of operations) {
    command.push(operation.operation);
    command.push(operation.type);
    command.push(`${operation.offset}`);

    if (operation.operation === 'SET') {
      command.push(`${operation.value}`);
    } else if (operation.operation === 'INCRBY') {
      command.push(`${operation.increment}`);
    }
  }

  return command;
}

export async function bitfield<T>(
  this: T,
  key: string,
  operations: CommandBitfieldOperationOption[],
  overflow?: RespBitfieldOverflow,
): Promise<(SolidisInteger<T> | null)[] | null> {
  return await executeCommand(
    this,
    createCommand(key, operations, overflow),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      return tryReplyArray(reply, command).map((value) =>
        value === null ? null : tryReplyToInteger(value, command, this),
      );
    },
  );
}

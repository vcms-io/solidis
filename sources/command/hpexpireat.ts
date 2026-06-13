import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

import type { CommandExpireMode } from '../index.ts';

export function createCommand(
  key: string,
  millisecondsTimestamp: number,
  fields: string[],
  mode?: CommandExpireMode,
) {
  const command = ['HPEXPIREAT', key, `${millisecondsTimestamp}`];

  if (mode) {
    command.push(mode);
  }

  command.push('FIELDS', `${fields.length}`, ...fields);

  return command;
}

export async function hpexpireat<T>(
  this: T,
  key: string,
  millisecondsTimestamp: number,
  fields: string[],
  mode?: CommandExpireMode,
): Promise<number[]> {
  return await executeCommand(
    this,
    createCommand(key, millisecondsTimestamp, fields, mode),
    tryReplyToNumberArray,
  );
}

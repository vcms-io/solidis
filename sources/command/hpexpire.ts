import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

import type { CommandExpireMode } from '../index.ts';

export function createCommand(
  key: string,
  milliseconds: number,
  fields: string[],
  mode?: CommandExpireMode,
) {
  const command = ['HPEXPIRE', key, `${milliseconds}`];

  if (mode) {
    command.push(mode);
  }

  command.push('FIELDS', `${fields.length}`, ...fields);

  return command;
}

export async function hpexpire<T>(
  this: T,
  key: string,
  milliseconds: number,
  fields: string[],
  mode?: CommandExpireMode,
): Promise<number[]> {
  return await executeCommand(
    this,
    createCommand(key, milliseconds, fields, mode),
    tryReplyToNumberArray,
  );
}

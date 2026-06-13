import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

import type { CommandExpireMode } from '../index.ts';

export function createCommand(
  key: string,
  seconds: number,
  fields: string[],
  mode?: CommandExpireMode,
) {
  const command = ['HEXPIRE', key, `${seconds}`];

  if (mode) {
    command.push(mode);
  }

  command.push('FIELDS', `${fields.length}`, ...fields);

  return command;
}

export async function hexpire<T>(
  this: T,
  key: string,
  seconds: number,
  fields: string[],
  mode?: CommandExpireMode,
): Promise<number[]> {
  return await executeCommand(
    this,
    createCommand(key, seconds, fields, mode),
    tryReplyToNumberArray,
  );
}

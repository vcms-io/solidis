import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

import type { CommandExpireMode } from '../index.ts';

export function createCommand(
  key: string,
  timestamp: number,
  fields: string[],
  mode?: CommandExpireMode,
) {
  const command = ['HEXPIREAT', key, `${timestamp}`];

  if (mode) {
    command.push(mode);
  }

  command.push('FIELDS', `${fields.length}`, ...fields);

  return command;
}

export async function hexpireat<T>(
  this: T,
  key: string,
  timestamp: number,
  fields: string[],
  mode?: CommandExpireMode,
): Promise<number[]> {
  return await executeCommand(
    this,
    createCommand(key, timestamp, fields, mode),
    tryReplyToNumberArray,
  );
}

import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

import type { CommandLimitOptions } from '../index.ts';

export function createCommand(
  key: string,
  min: string,
  max: string,
  limit?: CommandLimitOptions,
) {
  const command = ['ZRANGEBYLEX', key, min, max];

  if (limit) {
    command.push('LIMIT', `${limit.offset}`, `${limit.count}`);
  }

  return command;
}

export async function zrangebylex<T>(
  this: T,
  key: string,
  min: string,
  max: string,
  limit?: CommandLimitOptions,
): Promise<string[]> {
  return await executeCommand(
    this,
    createCommand(key, min, max, limit),
    tryReplyToStringArray,
  );
}

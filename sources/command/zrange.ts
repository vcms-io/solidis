import {
  buildSortedSetRangeCommand,
  executeCommand,
  tryReplyToStringsOrSortedSetMembers,
} from './utils/index.ts';

import type { CommandZRangeOptions, RespSortedSetMember } from '../index.ts';

export function createCommand(
  key: string,
  min: string,
  max: string,
  options: CommandZRangeOptions,
) {
  return buildSortedSetRangeCommand(['ZRANGE', key, min, max], options);
}

export async function zrange<T>(
  this: T,
  key: string,
  min: string,
  max: string,
  options: CommandZRangeOptions = {},
): Promise<string[] | RespSortedSetMember[]> {
  return await executeCommand(
    this,
    createCommand(key, min, max, options),
    (reply, command) =>
      tryReplyToStringsOrSortedSetMembers(reply, command, options.withScores),
  );
}

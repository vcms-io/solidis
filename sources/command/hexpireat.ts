import {
  buildHashFieldExpireCommand,
  executeCommand,
  tryReplyToNumberArray,
} from './utils/index.ts';

import type { CommandExpireMode } from '../index.ts';

export function createCommand(
  key: string,
  timestamp: number,
  fields: string[],
  mode?: CommandExpireMode,
) {
  return buildHashFieldExpireCommand('HEXPIREAT', key, timestamp, fields, mode);
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

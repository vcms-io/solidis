import {
  buildHashFieldExpireCommand,
  executeCommand,
  tryReplyToNumberArray,
} from './utils/index.ts';

import type { CommandExpireMode } from '../index.ts';

export function createCommand(
  key: string,
  seconds: number,
  fields: string[],
  mode?: CommandExpireMode,
) {
  return buildHashFieldExpireCommand('HEXPIRE', key, seconds, fields, mode);
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

import {
  buildHashFieldExpireCommand,
  executeCommand,
  tryReplyToNumberArray,
} from './utils/index.ts';

import type { CommandExpireMode } from '../index.ts';

export function createCommand(
  key: string,
  milliseconds: number,
  fields: string[],
  mode?: CommandExpireMode,
) {
  return buildHashFieldExpireCommand(
    'HPEXPIRE',
    key,
    milliseconds,
    fields,
    mode,
  );
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

import {
  buildHashFieldExpireCommand,
  executeCommand,
  tryReplyToNumberArray,
} from './utils/index.ts';

import type { CommandExpireMode } from '../index.ts';

export function createCommand(
  key: string,
  millisecondsTimestamp: number,
  fields: string[],
  mode?: CommandExpireMode,
) {
  return buildHashFieldExpireCommand(
    'HPEXPIREAT',
    key,
    millisecondsTimestamp,
    fields,
    mode,
  );
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

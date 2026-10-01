import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { CommandBeforeOrAfterOption, StringOrBuffer } from '../index.ts';

export function createCommand(
  key: string,
  position: CommandBeforeOrAfterOption,
  pivot: StringOrBuffer,
  element: StringOrBuffer,
) {
  return ['LINSERT', key, position, pivot, element];
}

export async function linsert<T>(
  this: T,
  key: string,
  position: CommandBeforeOrAfterOption,
  pivot: StringOrBuffer,
  element: StringOrBuffer,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, position, pivot, element),
    tryReplyNumber,
  );
}

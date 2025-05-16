import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { CommandBeforeOrAfterOption } from '../index.ts';

export function createCommand(
  key: string,
  position: CommandBeforeOrAfterOption,
  pivot: string,
  element: string,
) {
  return ['LINSERT', key, position, pivot, element];
}

export async function linsert<T>(
  this: T,
  key: string,
  position: CommandBeforeOrAfterOption,
  pivot: string,
  element: string,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, position, pivot, element),
    tryReplyNumber,
  );
}

import { executeCommand, tryReplyToNumberOrErrorArray } from './utils/index.ts';

import type { RespError } from '../index.ts';

export function createCommand(key: string, items: string[]) {
  return ['BF.MADD', key, ...items];
}

export async function bfMadd<T>(
  this: T,
  key: string,
  items: string[],
): Promise<(number | RespError)[]> {
  return await executeCommand(
    this,
    createCommand(key, items),
    tryReplyToNumberOrErrorArray,
  );
}

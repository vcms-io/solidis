import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(
  key: string,
  count: number,
  element: StringOrBuffer,
) {
  return ['LREM', key, formatInteger(count), element];
}

export async function lrem<T>(
  this: T,
  key: string,
  count: number,
  element: StringOrBuffer,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, count, element),
    tryReplyNumber,
  );
}

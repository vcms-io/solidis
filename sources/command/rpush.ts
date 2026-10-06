import { appendItems } from '../common/utils/internal.ts';
import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(key: string, ...elements: StringOrBuffer[]) {
  return ['RPUSH', key, ...elements];
}

export async function rpush<T>(
  this: T,
  key: string,
  ...elements: StringOrBuffer[]
): Promise<number> {
  return await executeCommand(
    this,
    appendItems(createCommand(key), elements),
    tryReplyNumber,
  );
}

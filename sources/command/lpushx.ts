import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(key: string, elements: StringOrBuffer[]) {
  return ['LPUSHX', key, ...elements];
}

export async function lpushx<T>(
  this: T,
  key: string,
  elements: StringOrBuffer[],
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, elements),
    tryReplyNumber,
  );
}

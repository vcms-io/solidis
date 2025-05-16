import { executeCommand, tryReplyToString } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(
  key: string,
  id: string,
  fields: Record<string, StringOrBuffer>,
) {
  return ['XADD', key, id, ...Object.entries(fields).flat()];
}

export async function xadd<T>(
  this: T,
  key: string,
  id: string,
  fields: Record<string, StringOrBuffer>,
): Promise<string> {
  return await executeCommand(
    this,
    createCommand(key, id, fields),
    tryReplyToString,
  );
}

import { executeCommand, tryReplyToStreamEntries } from './utils/index.ts';

import type { RespStreamEntry } from '../index.ts';

export function createCommand(key: string, start: string, end: string) {
  return ['XRANGE', key, start, end];
}

export async function xrange<T>(
  this: T,
  key: string,
  start: string,
  end: string,
): Promise<RespStreamEntry[]> {
  return await executeCommand(
    this,
    createCommand(key, start, end),
    tryReplyToStreamEntries,
  );
}

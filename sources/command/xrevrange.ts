import { executeCommand, tryReplyToStreamEntries } from './utils/index.ts';

import type { RespStreamEntry } from '../index.ts';

export function createCommand(key: string, end: string, start: string) {
  return ['XREVRANGE', key, end, start];
}

export async function xrevrange<T>(
  this: T,
  key: string,
  end: string,
  start: string,
): Promise<RespStreamEntry[]> {
  return await executeCommand(
    this,
    createCommand(key, end, start),
    tryReplyToStreamEntries,
  );
}

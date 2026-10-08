import {
  appendRecordEntries,
  executeCommand,
  tryReplyToString,
} from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(
  key: string,
  id: string,
  fields: Record<string, StringOrBuffer>,
) {
  return appendRecordEntries(['XADD', key, id], fields);
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

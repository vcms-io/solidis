import {
  appendRecordEntries,
  executeCommand,
  tryReplyOK,
} from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(mapping: Record<string, StringOrBuffer>) {
  return appendRecordEntries(['MSET'], mapping);
}

export async function mset<T>(
  this: T,
  mapping: Record<string, StringOrBuffer>,
) {
  return await executeCommand(this, createCommand(mapping), tryReplyOK);
}

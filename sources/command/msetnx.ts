import {
  appendRecordEntries,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(keyValues: Record<string, StringOrBuffer>) {
  return appendRecordEntries(['MSETNX'], keyValues);
}

export async function msetnx<T>(
  this: T,
  keyValues: Record<string, StringOrBuffer>,
): Promise<number> {
  return await executeCommand(this, createCommand(keyValues), tryReplyNumber);
}

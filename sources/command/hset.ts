import {
  appendRecordEntries,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(
  key: string,
  ...parameters:
    | [field: string, value: StringOrBuffer]
    | [fields: Record<string, StringOrBuffer>]
): StringOrBuffer[] {
  if (parameters.length === 2) {
    return ['HSET', key, ...parameters];
  }

  return appendRecordEntries(['HSET', key], parameters[0]);
}

export async function hset<T>(
  this: T,
  key: string,
  ...parameters:
    | [field: string, value: StringOrBuffer]
    | [fields: Record<string, StringOrBuffer>]
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, ...parameters),
    tryReplyNumber,
  );
}

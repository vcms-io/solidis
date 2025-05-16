import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(key: string, value: StringOrBuffer) {
  return ['GETSET', key, value];
}

/**
 * @deprecated
 * @see https://redis.io/docs/latest/commands/getset/
 * As of Redis version 6.2.0, this command is regarded as deprecated.
 * Use `set` with the `returnOldValue` option instead.
 */
export async function getset<T>(
  this: T,
  key: string,
  value: StringOrBuffer,
): Promise<string | null> {
  return await executeCommand(
    this,
    createCommand(key, value),
    tryReplyToStringOrNull,
  );
}

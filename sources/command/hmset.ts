import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(
  key: string,
  mapping: Record<string, StringOrBuffer>,
) {
  const command: StringOrBuffer[] = ['HMSET', key];

  for (const [field, value] of Object.entries(mapping)) {
    command.push(field, value);
  }

  return command;
}

/**
 * @deprecated
 * @see https://redis.io/docs/latest/commands/hmset/
 * As of Redis version 4.0.0, this command is regarded as deprecated.
 * Use `hset` instead.
 */
export async function hmset<T>(
  this: T,
  key: string,
  mapping: Record<string, StringOrBuffer>,
) {
  return await executeCommand(this, createCommand(key, mapping), tryReplyOK);
}

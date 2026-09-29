import { executeCommand, tryReplyToString } from './utils/index.ts';

import type { RespDataTypes } from '../index.ts';

export function createCommand(key: string) {
  return ['TYPE', key];
}

export async function type<T>(
  this: T,
  key: string,
): Promise<RespDataTypes | 'NONE' | (string & {})> {
  return await executeCommand(this, createCommand(key), (reply, command) =>
    tryReplyToString(reply, command).toUpperCase(),
  );
}

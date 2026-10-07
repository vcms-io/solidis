import {
  executeCommand,
  tryReplyToBoolean,
  tryReplyToValueOrErrorArray,
} from './utils/index.ts';

import type { RespError } from '../index.ts';

export function createCommand(key: string, items: string[]) {
  return ['BF.MADD', key, ...items];
}

export async function bfMadd<T>(
  this: T,
  key: string,
  items: string[],
): Promise<(boolean | RespError)[]> {
  const count = items.length;

  return await executeCommand(
    this,
    createCommand(key, items),
    (reply, command) =>
      tryReplyToValueOrErrorArray(reply, command, count, tryReplyToBoolean),
  );
}

import {
  buildSetCommand,
  executeCommand,
  tryReplyOK,
  tryReplyToString,
} from './utils/index.ts';

import type { CommandSetOptions, RespOK, StringOrBuffer } from '../index.ts';

export function createCommand(
  key: string,
  value: StringOrBuffer,
  options?: CommandSetOptions,
) {
  return buildSetCommand(key, value, options);
}

export async function set<T>(
  this: T,
  key: string,
  value: StringOrBuffer,
  options?: CommandSetOptions,
): Promise<StringOrBuffer | RespOK | null> {
  return await executeCommand(
    this,
    createCommand(key, value, options),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (options?.returnOldValue === true) {
        if (
          options.returnOldValueAsBuffer === true &&
          (reply instanceof Buffer || typeof reply === 'string')
        ) {
          return Buffer.isBuffer(reply) ? reply : Buffer.from(reply);
        }

        return tryReplyToString(reply, command);
      }

      return tryReplyOK(reply, command);
    },
  );
}

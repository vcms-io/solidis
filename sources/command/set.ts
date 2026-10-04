import {
  buildSetCommand,
  executeCommand,
  tryReplyOK,
  tryReplyToStringOrBuffer,
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
    (reply, command, replyOptions) => {
      if (reply === null) {
        return null;
      }

      if (replyOptions?.returnOldValue === true) {
        return tryReplyToStringOrBuffer(reply, command, {
          buffer: replyOptions.returnOldValueAsBuffer,
        });
      }

      return tryReplyOK(reply, command);
    },
    options,
  );
}

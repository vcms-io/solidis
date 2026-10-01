import {
  appendExpireOptions,
  executeCommand,
  tryReplyToStringOrBufferOrNull,
} from './utils/index.ts';

import type { CommandGetExOptions, RespString } from '../index.ts';

export function createCommand(key: string, options?: CommandGetExOptions) {
  const command = ['GETEX', key];

  if (options) {
    appendExpireOptions(command, options);

    if (options.persist === true) {
      command.push('PERSIST');
    }
  }

  return command;
}

export async function getex<
  T,
  Options extends CommandGetExOptions | undefined = undefined,
>(
  this: T,
  key: string,
  options?: Options,
): Promise<RespString<Options> | null> {
  return await executeCommand(
    this,
    createCommand(key, options),
    (reply, command) => tryReplyToStringOrBufferOrNull(reply, command, options),
  );
}

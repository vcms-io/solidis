import {
  appendExpireOptions,
  executeCommand,
  tryReplyToStringOrBufferOrNull,
} from './utils/index.ts';

import type {
  CommandExactOptions,
  CommandGetExOptions,
  RespString,
} from '../index.ts';

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
  options?: Options & CommandExactOptions<Options, CommandGetExOptions>,
): Promise<RespString<Options> | null> {
  return await executeCommand(
    this,
    createCommand(key, options),
    (reply, command) =>
      tryReplyToStringOrBufferOrNull<Options>(reply, command, options),
  );
}

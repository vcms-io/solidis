import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { CommandShutdownOptions } from '../index.ts';

export function createCommand(options?: CommandShutdownOptions) {
  const command = ['SHUTDOWN'];

  if (options) {
    if (options.nosave) {
      command.push('NOSAVE');
    } else if (options.save) {
      command.push('SAVE');
    }

    if (options.now) {
      command.push('NOW');
    }

    if (options.force) {
      command.push('FORCE');
    }

    if (options.abort) {
      command.push('ABORT');
    }
  }

  return command;
}

export async function shutdown<T>(this: T, options?: CommandShutdownOptions) {
  return await executeCommand(this, createCommand(options), tryReplyOK);
}

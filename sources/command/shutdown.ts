import { SolidisConnectionClosedMessage } from '../common/utils/internal.ts';
import { RespOK } from '../types/resp.ts';
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
  try {
    return await executeCommand(this, createCommand(options), tryReplyOK);
  } catch (error) {
    if (
      options?.abort ||
      !(error instanceof Error) ||
      error.message !== SolidisConnectionClosedMessage
    ) {
      throw error;
    }

    return RespOK;
  }
}

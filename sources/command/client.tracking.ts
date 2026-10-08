import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, newCommandError, tryReplyOK } from './utils/index.ts';

import type { CommandClientTrackingOptions, RespOnOrOff } from '../index.ts';

export function createCommand(
  mode: RespOnOrOff,
  options?: CommandClientTrackingOptions,
) {
  const command = ['CLIENT', 'TRACKING', mode];

  if (options) {
    if (options.redirect !== undefined) {
      command.push('REDIRECT', formatInteger(options.redirect));
    }

    if (options.prefixes?.length === 0) {
      throw newCommandError(
        'An empty list of prefixes would track every key',
        command,
      );
    }

    for (const prefix of options.prefixes ?? []) {
      command.push('PREFIX', prefix);
    }

    if (options.bcast) {
      command.push('BCAST');
    }

    if (options.optin) {
      command.push('OPTIN');
    }

    if (options.optout) {
      command.push('OPTOUT');
    }

    if (options.noloop) {
      command.push('NOLOOP');
    }
  }

  return command;
}

export async function clientTracking<T>(
  this: T,
  mode: RespOnOrOff,
  options?: CommandClientTrackingOptions,
) {
  return await executeCommand(this, createCommand(mode, options), tryReplyOK);
}

import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { CommandClientTrackingOptions, RespOnOrOff } from '../index.ts';

export function createCommand(
  mode: RespOnOrOff,
  options?: CommandClientTrackingOptions,
) {
  const command = ['CLIENT', 'TRACKING', mode];

  if (options) {
    if (options.redirect !== undefined) {
      command.push('REDIRECT', `${options.redirect}`);
    }

    if (options.prefixes) {
      for (const prefix of options.prefixes) {
        command.push('PREFIX');
        command.push(prefix);
      }
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

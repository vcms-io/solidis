import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { CommandFailoverOptions } from '../index.ts';

export function createCommand(options?: CommandFailoverOptions) {
  const command = ['FAILOVER'];

  if (options?.to) {
    command.push('TO', options.to.host, formatInteger(options.to.port));
  }

  if (options?.force) {
    command.push('FORCE');
  }

  if (options?.abort) {
    command.push('ABORT');
  }

  if (options?.timeout !== undefined) {
    command.push('TIMEOUT', formatInteger(options.timeout));
  }

  return command;
}

export async function failover<T>(this: T, options?: CommandFailoverOptions) {
  return await executeCommand(this, createCommand(options), tryReplyOK);
}

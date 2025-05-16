import { executeCommand, tryReplyToString } from './utils/index.ts';

import type { CommandClientListOptions } from '../index.ts';

export function createCommand(options?: CommandClientListOptions) {
  const command = ['CLIENT', 'LIST'];

  if (options) {
    if (options.type) {
      command.push('TYPE', options.type);
    }
    if (options.identifiers && options.identifiers.length > 0) {
      command.push('ID', ...options.identifiers.map(String));
    }
  }

  return command;
}

export async function clientList<T>(
  this: T,
  options?: CommandClientListOptions,
): Promise<string> {
  return await executeCommand(this, createCommand(options), tryReplyToString);
}

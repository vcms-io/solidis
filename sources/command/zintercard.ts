import {
  buildSortedSetInterCommand,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

import type { CommandZInterOptions } from '../index.ts';

export function createCommand(
  keys: string[],
  limit: number | undefined,
  options: CommandZInterOptions,
) {
  const command = buildSortedSetInterCommand(['ZINTERCARD'], keys, options);

  if (limit !== undefined) {
    command.push('LIMIT', `${limit}`);
  }

  return command;
}

export async function zintercard<T>(
  this: T,
  keys: string[],
  limit?: number,
  options: CommandZInterOptions = {},
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(keys, limit, options),
    tryReplyNumber,
  );
}

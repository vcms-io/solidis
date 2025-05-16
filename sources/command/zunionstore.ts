import {
  buildSortedSetInterCommand,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

import type { CommandZInterOptions } from '../index.ts';

export function createCommand(
  destination: string,
  keys: string[],
  options: CommandZInterOptions = {},
) {
  return buildSortedSetInterCommand(
    ['ZUNIONSTORE', destination],
    keys,
    options,
  );
}

export async function zunionstore<T>(
  this: T,
  destination: string,
  keys: string[],
  options: CommandZInterOptions = {},
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(destination, keys, options),
    tryReplyNumber,
  );
}

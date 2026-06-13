import {
  executeCommand,
  newCommandError,
  tryReplyToStreamReadResultsOrNull,
} from './utils/index.ts';

import type { RespStreamReadResult } from '../index.ts';

export function createCommand(
  keys: string[],
  ids: string[],
  count?: number,
  block?: number,
) {
  const command = ['XREAD'];

  if (count !== undefined) {
    command.push('COUNT', `${count}`);
  }

  if (block !== undefined) {
    command.push('BLOCK', `${block}`);
  }

  command.push('STREAMS', ...keys, ...ids);

  return command;
}

export async function xread<T>(
  this: T,
  keys: string[],
  ids: string[],
  count?: number,
  block?: number,
): Promise<RespStreamReadResult[] | null> {
  if (keys.length !== ids.length) {
    throw newCommandError('Keys and IDs must have the same length', 'XREAD');
  }

  return await executeCommand(
    this,
    createCommand(keys, ids, count, block),
    tryReplyToStreamReadResultsOrNull,
  );
}

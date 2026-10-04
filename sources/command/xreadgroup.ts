import {
  executeCommand,
  newCommandError,
  tryReplyToStreamGroupReadResultsOrNull,
} from './utils/index.ts';

import type { RespStreamGroupReadResult } from '../index.ts';

export function createCommand(
  group: string,
  consumer: string,
  keys: string[],
  ids: string[],
  count?: number,
  block?: number,
  noack?: boolean,
) {
  const command = ['XREADGROUP', 'GROUP', group, consumer];

  if (count !== undefined) {
    command.push('COUNT', `${count}`);
  }

  if (block !== undefined) {
    command.push('BLOCK', `${block}`);
  }

  if (noack) {
    command.push('NOACK');
  }

  return [...command, 'STREAMS', ...keys, ...ids];
}

export async function xreadgroup<T>(
  this: T,
  group: string,
  consumer: string,
  keys: string[],
  ids: string[],
  count?: number,
  block?: number,
  noack?: boolean,
): Promise<RespStreamGroupReadResult[] | null> {
  if (keys.length !== ids.length) {
    throw newCommandError(
      'Keys and IDs must have the same length',
      'XREADGROUP',
    );
  }

  return await executeCommand(
    this,
    createCommand(group, consumer, keys, ids, count, block, noack),
    tryReplyToStreamGroupReadResultsOrNull,
    undefined,
    { blockingTimeout: block },
  );
}

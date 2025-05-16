import {
  InvalidReplyPrefix,
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
  tryReplyToStreamEntry,
} from './utils/index.ts';

import type { RespStreamReadResult } from '../index.ts';

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

  command.push('STREAMS', ...keys, ...ids);

  return command;
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
): Promise<RespStreamReadResult[] | null> {
  if (keys.length !== ids.length) {
    throw newCommandError(
      'Keys and IDs must have the same length',
      'XREADGROUP',
    );
  }

  return await executeCommand(
    this,
    createCommand(group, consumer, keys, ids, count, block, noack),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return reply.map((stream): RespStreamReadResult => {
        if (!Array.isArray(stream) || stream.length !== 2) {
          throw newCommandError(`${InvalidReplyPrefix}: ${stream}`, command);
        }

        const [name, entries] = stream;

        if (!Array.isArray(entries)) {
          throw newCommandError(`${InvalidReplyPrefix}: ${entries}`, command);
        }

        return {
          stream: String(name),
          entries: entries.map(tryReplyToStreamEntry),
        };
      });
    },
  );
}

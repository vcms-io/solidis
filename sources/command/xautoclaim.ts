import {
  executeCommand,
  newCommandError,
  tryReplyToStreamEntry,
  tryReplyToString,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { RespStreamAutoClaimResult } from '../index.ts';

export function createCommand(
  key: string,
  group: string,
  consumer: string,
  minIdleTime: number,
  start: string,
  count?: number,
  justid?: boolean,
) {
  const command = ['XAUTOCLAIM', key, group, consumer, `${minIdleTime}`, start];

  if (count !== undefined) {
    command.push('COUNT', `${count}`);
  }

  if (justid) {
    command.push('JUSTID');
  }

  return command;
}

export async function xautoclaim<T>(
  this: T,
  key: string,
  group: string,
  consumer: string,
  minIdleTime: number,
  start: string,
  count?: number,
  justid?: boolean,
): Promise<RespStreamAutoClaimResult> {
  return await executeCommand(
    this,
    createCommand(key, group, consumer, minIdleTime, start, count, justid),
    (reply, command) => {
      if (Array.isArray(reply) && (reply.length === 2 || reply.length === 3)) {
        const [nextId, entries] = reply;

        if (
          (typeof nextId === 'string' || nextId instanceof Buffer) &&
          Array.isArray(entries)
        ) {
          if (justid) {
            return {
              nextId: `${nextId}`,
              entries: entries.map((entry) => ({
                id: tryReplyToString(entry),
                fields: {},
              })),
            };
          }

          return {
            nextId: `${nextId}`,
            entries: entries.map(tryReplyToStreamEntry),
          };
        }
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}

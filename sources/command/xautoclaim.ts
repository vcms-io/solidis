import {
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  processPairedArray,
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
      if (Array.isArray(reply) && reply.length === 2) {
        const [nextId, entries] = reply;

        if (
          (typeof nextId === 'string' || nextId instanceof Buffer) &&
          Array.isArray(entries)
        ) {
          return {
            nextId: `${nextId}`,
            entries: entries.map((entry) => {
              if (!Array.isArray(entry) || entry.length !== 2) {
                throw newCommandError(
                  `${InvalidReplyPrefix}: ${entry}`,
                  command,
                );
              }

              const [id, fields] = entry;

              const parsedFields: Record<string, string> = {};

              processPairedArray(
                fields,
                (key, value) => {
                  parsedFields[key] = tryReplyToString(value);
                },
                command,
              );

              return {
                id: tryReplyToString(id),
                fields: parsedFields,
              };
            }),
          };
        }
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}

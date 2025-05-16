import {
  InvalidReplyPrefix,
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
  processPairedArray,
  tryReplyToString,
} from './utils/index.ts';

import type { RespStreamEntry } from '../index.ts';

export interface XclaimOptions {
  idle?: number;
  time?: number;
  retrycount?: number;
  force?: boolean;
  justid?: boolean;
}

export function createCommand(
  key: string,
  group: string,
  consumer: string,
  minIdleTime: number,
  ids: string[],
  options?: XclaimOptions,
) {
  const command = ['XCLAIM', key, group, consumer, `${minIdleTime}`, ...ids];

  if (options?.idle !== undefined) {
    command.push('IDLE', `${options.idle}`);
  }

  if (options?.time !== undefined) {
    command.push('TIME', `${options.time}`);
  }

  if (options?.retrycount !== undefined) {
    command.push('RETRYCOUNT', `${options.retrycount}`);
  }

  if (options?.force) {
    command.push('FORCE');
  }

  if (options?.justid) {
    command.push('JUSTID');
  }

  return command;
}

export async function xclaim<T>(
  this: T,
  key: string,
  group: string,
  consumer: string,
  minIdleTime: number,
  ids: string[],
  options?: XclaimOptions,
): Promise<RespStreamEntry[]> {
  return await executeCommand(
    this,
    createCommand(key, group, consumer, minIdleTime, ids, options),
    (reply, command) => {
      if (Array.isArray(reply)) {
        return reply.map((entry) => {
          if (!Array.isArray(entry) || entry.length !== 2) {
            throw newCommandError(`${InvalidReplyPrefix}: ${entry}`, command);
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
        });
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}

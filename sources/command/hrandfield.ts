import {
  executeCommand,
  processPairedArray,
  tryReplyArray,
  tryReplyToString,
  tryReplyToStringArray,
} from './utils/index.ts';

import type { RespHashEntry, StringOrBuffer } from '../index.ts';

export function createCommand(
  key: string,
  count?: number,
  withvalues?: boolean,
) {
  const command = ['HRANDFIELD', key];

  if (count !== undefined || withvalues) {
    command.push(`${count ?? 1}`);
  }

  if (withvalues) {
    command.push('WITHVALUES');
  }

  return command;
}

function tryReplyToHashEntries(reply: unknown, command: StringOrBuffer[]) {
  const entries: RespHashEntry[] = [];

  processPairedArray(
    tryReplyArray(reply, command).flat(),
    (field, value) => {
      entries.push({ field, value: tryReplyToString(value, command) });
    },
    command,
  );

  return entries;
}

export async function hrandfield<T>(
  this: T,
  key: string,
): Promise<string | null>;
export async function hrandfield<T>(
  this: T,
  key: string,
  count: number,
  withvalues?: false,
): Promise<string[]>;
export async function hrandfield<T>(
  this: T,
  key: string,
  count: number | undefined,
  withvalues: true,
): Promise<RespHashEntry[]>;
export async function hrandfield<T>(
  this: T,
  key: string,
  count?: number,
  withvalues?: boolean,
): Promise<string | string[] | RespHashEntry[] | null>;
export async function hrandfield<T>(
  this: T,
  key: string,
  count?: number,
  withvalues?: boolean,
): Promise<string | string[] | RespHashEntry[] | null> {
  return await executeCommand(
    this,
    createCommand(key, count, withvalues),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (withvalues) {
        return tryReplyToHashEntries(reply, command);
      }

      if (count === undefined) {
        return tryReplyToString(reply, command);
      }

      return tryReplyToStringArray(reply, command);
    },
  );
}

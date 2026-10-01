import {
  executeCommand,
  tryReplyArray,
  tryReplyToStreamEntries,
  tryReplyToString,
  tryReplyToStringArray,
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
      const [nextId, entries, deletedIds] = tryReplyArray(reply, command);

      return {
        nextId: tryReplyToString(nextId, command),
        entries: justid
          ? tryReplyToStringArray(entries, command).map((id) => ({
              id,
              fields: {},
            }))
          : tryReplyToStreamEntries(entries, command),
        deletedIds: tryReplyToStringArray(deletedIds ?? [], command),
      };
    },
  );
}

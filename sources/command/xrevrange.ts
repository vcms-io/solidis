import {
  executeCommand,
  newCommandError,
  tryReplyToStreamEntry,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { RespStreamEntry } from '../index.ts';

export function createCommand(key: string, end: string, start: string) {
  return ['XREVRANGE', key, end, start];
}

export async function xrevrange<T>(
  this: T,
  key: string,
  end: string,
  start: string,
): Promise<RespStreamEntry[]> {
  return await executeCommand(
    this,
    createCommand(key, end, start),
    (reply, command) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return reply.map(tryReplyToStreamEntry);
    },
  );
}

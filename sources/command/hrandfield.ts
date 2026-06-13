import {
  executeCommand,
  newCommandError,
  tryReplyToStringArray,
  tryReplyToStringRecord,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { RespHashField } from '../index.ts';

export function createCommand(
  key: string,
  count?: number,
  withvalues?: boolean,
) {
  const command = ['HRANDFIELD', key];

  if (count !== undefined) {
    command.push(`${count}`);

    if (withvalues) {
      command.push('WITHVALUES');
    }
  }

  return command;
}

export async function hrandfield<T>(
  this: T,
  key: string,
  count?: number,
  withvalues?: boolean,
): Promise<string[] | RespHashField | string | null> {
  return await executeCommand(
    this,
    createCommand(key, count, withvalues),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (typeof reply === 'string' || reply instanceof Buffer) {
        return `${reply}`;
      }

      if (Array.isArray(reply)) {
        if (withvalues && count !== undefined) {
          /** RESP3 nests each field/value as a pair; flatten to match RESP2. */
          return tryReplyToStringRecord(reply.flat(), 'HRANDFIELD');
        }

        return tryReplyToStringArray(reply, command);
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}

import {
  executeCommand,
  newCommandError,
  processPairedArray,
  tryReplyToString,
  tryReplyToStringArray,
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
          const result: RespHashField = {};

          processPairedArray(
            reply,
            (field, value) => {
              result[field] = tryReplyToString(value, command);
            },
            'HRANDFIELD',
          );

          return result;
        }

        return tryReplyToStringArray(reply, command);
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}

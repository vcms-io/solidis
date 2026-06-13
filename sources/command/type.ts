import { RespDataTypes } from '../index.ts';
import {
  executeCommand,
  newCommandError,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

export function createCommand(key: string) {
  return ['TYPE', key];
}

export async function type<T>(
  this: T,
  key: string,
): Promise<RespDataTypes | 'NONE'> {
  return await executeCommand(this, createCommand(key), (reply, command) => {
    if (typeof reply === 'string' || reply instanceof Buffer) {
      const typeString = `${reply}`.toUpperCase();

      if (typeString === 'NONE') {
        return 'NONE';
      }

      const matched = Object.values(RespDataTypes).find(
        (v) => v === typeString,
      );

      if (matched !== undefined) {
        return matched;
      }
    }

    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
  });
}

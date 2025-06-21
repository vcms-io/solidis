import { RespJsonType } from '../index.ts';
import {
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

export function createCommand(key: string, path?: string) {
  const command = ['JSON.TYPE', key];

  if (path !== undefined) {
    command.push(path);
  }

  return command;
}

export async function jsonType<T>(
  this: T,
  key: string,
  path?: string,
): Promise<(RespJsonType | null)[]> {
  return await executeCommand(
    this,
    createCommand(key, path),
    (reply, command) => {
      if (Array.isArray(reply)) {
        return reply.map((item) => {
          if (item === null) {
            return null;
          }

          if (RespJsonType.includes(item as RespJsonType)) {
            return item as RespJsonType;
          }

          throw newCommandError(`${InvalidReplyPrefix}: ${item}`, command);
        });
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}

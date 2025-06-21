import {
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { RespStreamConsumerInfo } from '../index.ts';

export function createCommand(key: string, group: string) {
  return ['XINFO', 'CONSUMERS', key, group];
}

export async function xinfoConsumers<T>(
  this: T,
  key: string,
  group: string,
): Promise<RespStreamConsumerInfo[]> {
  return await executeCommand(
    this,
    createCommand(key, group),
    (reply, command) => {
      if (Array.isArray(reply)) {
        return reply.map((info) => {
          if (!Array.isArray(info)) {
            throw newCommandError(`${InvalidReplyPrefix}: ${info}`, command);
          }

          const result = new Map<string, string>();

          for (let index = 0; index < info.length; index += 2) {
            const key = info[index];
            const value = info[index + 1];

            if (!(typeof key === 'string' || key instanceof Buffer)) {
              throw newCommandError(`${InvalidReplyPrefix}: ${key}`, command);
            }

            if (
              !(
                typeof value === 'string' ||
                value instanceof Buffer ||
                typeof value === 'number'
              )
            ) {
              throw newCommandError(
                `${InvalidReplyPrefix}: ${key}/${value}`,
                command,
              );
            }

            const keyString = `${key}`.toLowerCase();

            result.set(keyString, `${value}`);
          }

          return {
            name: String(result.get('name')),
            pending: Number(result.get('pending')),
            idle: Number(result.get('idle')),
            inactive: Number(result.get('inactive')),
          };
        });
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}

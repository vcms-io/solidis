import {
  InvalidReplyPrefix,
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
} from './utils/index.ts';

import type { RespStreamGroupInfo } from '../index.ts';

export function createCommand(key: string) {
  return ['XINFO', 'GROUPS', key];
}

export async function xinfoGroups<T>(
  this: T,
  key: string,
): Promise<RespStreamGroupInfo[]> {
  return await executeCommand(this, createCommand(key), (reply, command) => {
    if (Array.isArray(reply)) {
      return reply.map((info) => {
        if (!Array.isArray(info)) {
          throw newCommandError(`${InvalidReplyPrefix}: ${info}`, command);
        }

        const result = new Map<string, string | number>();
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
          consumers: Number(result.get('consumers')),
          pending: Number(result.get('pending')),
          lastDeliveredId: String(result.get('last-delivered-id')),
          entriesRead: Number(result.get('entries-read')),
          lag: Number(result.get('lag')),
        };
      });
    }

    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
  });
}

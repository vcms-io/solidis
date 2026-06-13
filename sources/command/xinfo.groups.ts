import {
  executeCommand,
  newCommandError,
  tryReplyToMap,
  UnexpectedReplyPrefix,
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
    if (!Array.isArray(reply)) {
      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    }

    return reply.map((info) => {
      /**
       * Each group is a flat field/value array under RESP2 and a map under
       * RESP3; tryReplyToMap normalises both.
       */
      const result = tryReplyToMap(info, command);

      const entriesRead = result.get('entries-read');

      return {
        name: String(result.get('name')),
        consumers: Number(result.get('consumers')),
        pending: Number(result.get('pending')),
        lastDeliveredId: String(result.get('last-delivered-id')),
        entriesRead: entriesRead === null ? 0 : Number(entriesRead),
        lag: Number(result.get('lag')),
      };
    });
  });
}

import {
  executeCommand,
  tryReplyArray,
  tryReplyNumber,
  tryReplyToMap,
  tryReplyToNumberOrNull,
} from './utils/index.ts';

import type { RespStreamGroupInfo } from '../index.ts';

export function createCommand(key: string) {
  return ['XINFO', 'GROUPS', key];
}

export async function xinfoGroups<T>(
  this: T,
  key: string,
): Promise<RespStreamGroupInfo[]> {
  return await executeCommand(this, createCommand(key), (reply, command) =>
    tryReplyArray(reply, command).map((info) => {
      const result = tryReplyToMap(info, command);

      return {
        name: String(result.get('name')),
        consumers: tryReplyNumber(result.get('consumers'), command),
        pending: tryReplyNumber(result.get('pending'), command),
        lastDeliveredId: String(result.get('last-delivered-id')),
        entriesRead: tryReplyToNumberOrNull(
          result.get('entries-read') ?? null,
          command,
        ),
        lag: tryReplyToNumberOrNull(result.get('lag') ?? null, command),
      };
    }),
  );
}

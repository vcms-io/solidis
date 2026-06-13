import {
  executeCommand,
  newCommandError,
  tryReplyToMap,
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
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return reply.map((info) => {
        /** Each consumer is a flat field/value array (RESP2) or a map (RESP3). */
        const result = tryReplyToMap(info, command);

        return {
          name: String(result.get('name')),
          pending: Number(result.get('pending')),
          idle: Number(result.get('idle')),
          inactive: Number(result.get('inactive')),
        };
      });
    },
  );
}

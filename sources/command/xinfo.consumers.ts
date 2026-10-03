import {
  executeCommand,
  tryReplyArray,
  tryReplyToMap,
  tryReplyToNumberOrNull,
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
    (reply, command) =>
      tryReplyArray(reply, command).map((info) => {
        const result = tryReplyToMap(info, command);

        return {
          name: String(result.get('name')),
          pending: Number(result.get('pending')),
          idle: Number(result.get('idle')),
          inactive: tryReplyToNumberOrNull(
            result.get('inactive') ?? null,
            command,
          ),
        };
      }),
  );
}

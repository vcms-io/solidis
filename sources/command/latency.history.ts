import {
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { RespLatencyEvent, RespLatencyHistory } from '../index.ts';

export function createCommand(event: RespLatencyEvent) {
  return ['LATENCY', 'HISTORY', event];
}

export async function latencyHistory<T>(
  this: T,
  event: RespLatencyEvent,
): Promise<RespLatencyHistory[]> {
  return await executeCommand(this, createCommand(event), (reply, command) => {
    if (Array.isArray(reply)) {
      return reply.map((item) => {
        if (Array.isArray(item) && item.length === 2) {
          const [timestamp, latency] = item;

          if (typeof timestamp === 'number' && typeof latency === 'number') {
            return {
              timestamp,
              latency,
            };
          }
        }

        throw newCommandError(`${InvalidReplyPrefix}: ${item}`, command);
      });
    }

    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
  });
}

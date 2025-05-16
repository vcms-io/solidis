import {
  InvalidReplyPrefix,
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
} from './utils/index.ts';

import type { RespLatencyLatest } from '../index.ts';

export function createCommand() {
  return ['LATENCY', 'LATEST'];
}

export async function latencyLatest<T>(this: T): Promise<RespLatencyLatest[]> {
  return await executeCommand(this, createCommand(), (reply, command) => {
    if (Array.isArray(reply)) {
      return reply.map((item) => {
        if (Array.isArray(item) && item.length === 4) {
          const [event, timestamp, latency, maximumLatency] = item;
          if (
            (typeof event === 'string' || event instanceof Buffer) &&
            typeof timestamp === 'number' &&
            typeof latency === 'number' &&
            typeof maximumLatency === 'number'
          ) {
            return {
              event: `${event}`,
              timestamp,
              latency,
              maximumLatency,
            };
          }
        }
        throw newCommandError(`${InvalidReplyPrefix}: ${item}`, command);
      });
    }

    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
  });
}

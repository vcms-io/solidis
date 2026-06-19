import {
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { RespLatencyLatest } from '../index.ts';

export function createCommand() {
  return ['LATENCY', 'LATEST'];
}

export async function latencyLatest<T>(this: T): Promise<RespLatencyLatest[]> {
  return await executeCommand(this, createCommand(), (reply, command) => {
    if (Array.isArray(reply)) {
      return reply.map((item) => {
        if (Array.isArray(item) && item.length >= 4) {
          const [event, timestamp, latency, maximumLatency, sum, count] = item;
          if (
            (typeof event === 'string' || event instanceof Buffer) &&
            typeof timestamp === 'number' &&
            typeof latency === 'number' &&
            typeof maximumLatency === 'number'
          ) {
            const entry: RespLatencyLatest = {
              event: `${event}`,
              timestamp,
              latency,
              maximumLatency,
            };

            if (typeof sum === 'number') {
              entry.sum = sum;
            }
            if (typeof count === 'number') {
              entry.count = count;
            }

            return entry;
          }
        }
        throw newCommandError(`${InvalidReplyPrefix}: ${item}`, command);
      });
    }

    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
  });
}

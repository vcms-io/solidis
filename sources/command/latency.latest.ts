import {
  executeCommand,
  tryReplyArray,
  tryReplyNumber,
  tryReplyToString,
} from './utils/index.ts';

import type { RespLatencyLatest } from '../index.ts';

export function createCommand() {
  return ['LATENCY', 'LATEST'];
}

export async function latencyLatest<T>(this: T): Promise<RespLatencyLatest[]> {
  return await executeCommand(this, createCommand(), (reply, command) =>
    tryReplyArray(reply, command).map((item) => {
      const [event, timestamp, latency, maximumLatency, sum, count] =
        tryReplyArray(item, command);
      const entry: RespLatencyLatest = {
        event: tryReplyToString(event, command),
        timestamp: tryReplyNumber(timestamp, command),
        latency: tryReplyNumber(latency, command),
        maximumLatency: tryReplyNumber(maximumLatency, command),
      };

      if (sum !== undefined) {
        entry.sum = tryReplyNumber(sum, command);
      }

      if (count !== undefined) {
        entry.count = tryReplyNumber(count, command);
      }

      return entry;
    }),
  );
}

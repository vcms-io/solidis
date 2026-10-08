import {
  executeCommand,
  tryReplyArray,
  tryReplyNumber,
  tryReplyTuple,
} from './utils/index.ts';

import type { RespLatencyEvent, RespLatencyHistory } from '../index.ts';

export function createCommand(event: RespLatencyEvent) {
  return ['LATENCY', 'HISTORY', event];
}

export async function latencyHistory<T>(
  this: T,
  event: RespLatencyEvent,
): Promise<RespLatencyHistory[]> {
  return await executeCommand(this, createCommand(event), (reply, command) =>
    tryReplyArray(reply, command).map((item) => {
      const [timestamp, latency] = tryReplyTuple(item, 2, command);

      return {
        timestamp: tryReplyNumber(timestamp, command),
        latency: tryReplyNumber(latency, command),
      };
    }),
  );
}

import {
  executeCommand,
  newCommandError,
  tryReplyNumber,
} from './utils/index.ts';

import type { RespLatencyEvent } from '../index.ts';

export function createCommand(events?: RespLatencyEvent[]) {
  if (events?.length === 0) {
    throw newCommandError(
      'An empty list of events would reset every event',
      'LATENCY RESET',
    );
  }

  return ['LATENCY', 'RESET', ...(events ?? [])];
}

export async function latencyReset<T>(
  this: T,
  events?: RespLatencyEvent[],
): Promise<number> {
  return await executeCommand(this, createCommand(events), tryReplyNumber);
}

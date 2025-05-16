import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { RespLatencyEvent } from '../index.ts';

export function createCommand(events?: RespLatencyEvent[]) {
  const command = ['LATENCY', 'RESET'];

  if (events?.length) {
    command.push(...events);
  }

  return command;
}

export async function latencyReset<T>(
  this: T,
  events?: RespLatencyEvent[],
): Promise<number> {
  return await executeCommand(this, createCommand(events), tryReplyNumber);
}

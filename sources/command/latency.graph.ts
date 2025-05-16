import { executeCommand, tryReplyToString } from './utils/index.ts';

import type { RespLatencyEvent } from '../index.ts';

export function createCommand(event: RespLatencyEvent) {
  return ['LATENCY', 'GRAPH', event];
}

export async function latencyGraph<T>(
  this: T,
  event: RespLatencyEvent,
): Promise<string> {
  return await executeCommand(this, createCommand(event), tryReplyToString);
}

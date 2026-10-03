import { executeCommand, tryReplyToNumberRecord } from './utils/index.ts';

import type { RespPubsubNumsub } from '../index.ts';

export function createCommand(channels?: string[]) {
  return ['PUBSUB', 'NUMSUB', ...(channels ?? [])];
}

export async function pubsubNumsub<T>(
  this: T,
  channels?: string[],
): Promise<RespPubsubNumsub> {
  return await executeCommand(
    this,
    createCommand(channels),
    tryReplyToNumberRecord,
  );
}

import { executeCommand, tryReplyToNumberRecord } from './utils/index.ts';

import type { RespPubsubShardNumsub } from '../index.ts';

export function createCommand(shardChannels?: string[]) {
  return ['PUBSUB', 'SHARDNUMSUB', ...(shardChannels ?? [])];
}

export async function pubsubShardnumsub<T>(
  this: T,
  shardChannels?: string[],
): Promise<RespPubsubShardNumsub> {
  return await executeCommand(
    this,
    createCommand(shardChannels),
    tryReplyToNumberRecord,
  );
}

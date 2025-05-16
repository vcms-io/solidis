import {
  executeCommand,
  processPairedArray,
  tryReplyNumber,
} from './utils/index.ts';

import type { RespPubsubShardNumsub } from '../index.ts';

export function createCommand(shardChannels?: string[]) {
  const command = ['PUBSUB', 'SHARDNUMSUB'];

  if (shardChannels?.length) {
    command.push(...shardChannels);
  }

  return command;
}

export async function pubsubShardnumsub<T>(
  this: T,
  shardChannels?: string[],
): Promise<RespPubsubShardNumsub> {
  return await executeCommand(
    this,
    createCommand(shardChannels),
    (reply, command) => {
      const result: RespPubsubShardNumsub = {};

      processPairedArray(
        reply,
        (channel, count) => {
          result[channel] = tryReplyNumber(count, command);
        },
        'PUBSUB_SHARDNUMSUB',
      );

      return result;
    },
  );
}

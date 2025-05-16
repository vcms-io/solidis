import {
  executeCommand,
  processPairedArray,
  tryReplyNumber,
} from './utils/index.ts';

import type { RespPubsubNumsub } from '../index.ts';

export function createCommand(channels?: string[]) {
  const command = ['PUBSUB', 'NUMSUB'];

  if (channels?.length) {
    command.push(...channels);
  }

  return command;
}

export async function pubsubNumsub<T>(
  this: T,
  channels?: string[],
): Promise<RespPubsubNumsub> {
  return await executeCommand(
    this,
    createCommand(channels),
    (reply, command) => {
      const result: RespPubsubNumsub = {};

      processPairedArray(
        reply,
        (channel, count) => {
          result[channel] = tryReplyNumber(count, command);
        },
        'PUBSUB_NUMSUB',
      );

      return result;
    },
  );
}

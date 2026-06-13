import { executeCommand, tryReplyToNumberRecord } from './utils/index.ts';

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
    tryReplyToNumberRecord,
  );
}

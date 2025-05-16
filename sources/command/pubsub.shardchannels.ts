import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(pattern?: string) {
  const command = ['PUBSUB', 'SHARDCHANNELS'];

  if (pattern) {
    command.push(pattern);
  }

  return command;
}

export async function pubsubShardchannels<T>(
  this: T,
  pattern?: string,
): Promise<string[]> {
  return await executeCommand(
    this,
    createCommand(pattern),
    tryReplyToStringArray,
  );
}

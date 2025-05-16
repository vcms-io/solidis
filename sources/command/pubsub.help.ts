import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['PUBSUB', 'HELP'];
}

export async function pubsubHelp<T>(this: T): Promise<string[]> {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['LATENCY', 'HELP'];
}

export async function latencyHelp<T>(this: T): Promise<string[]> {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

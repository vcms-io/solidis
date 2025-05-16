import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['SLOWLOG', 'HELP'];
}

export async function slowlogHelp<T>(this: T): Promise<string[]> {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

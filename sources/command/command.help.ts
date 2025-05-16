import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['COMMAND', 'HELP'];
}

export async function commandHelp<T>(this: T): Promise<string[]> {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

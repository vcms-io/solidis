import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['SCRIPT', 'HELP'];
}

export async function scriptHelp<T>(this: T): Promise<string[]> {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['OBJECT', 'HELP'];
}

export async function objectHelp<T>(this: T): Promise<string[]> {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

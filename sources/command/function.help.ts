import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['FUNCTION', 'HELP'];
}

export async function functionHelp<T>(this: T): Promise<string[]> {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

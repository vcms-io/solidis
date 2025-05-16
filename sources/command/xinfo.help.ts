import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['XINFO', 'HELP'];
}

export async function xinfoHelp<T>(this: T): Promise<string[]> {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

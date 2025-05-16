import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['CLIENT', 'HELP'];
}

export async function clientHelp<T>(this: T): Promise<string[]> {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

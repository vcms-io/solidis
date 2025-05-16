import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['MEMORY', 'HELP'];
}

export async function memoryHelp<T>(this: T): Promise<string[]> {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['MODULE', 'HELP'];
}

export async function moduleHelp<T>(this: T): Promise<string[]> {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

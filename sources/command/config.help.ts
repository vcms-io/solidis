import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['CONFIG', 'HELP'];
}

export async function configHelp<T>(this: T): Promise<string[]> {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

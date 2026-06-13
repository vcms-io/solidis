import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand() {
  return ['XGROUP', 'HELP'];
}

export async function xgroupHelp<T>(this: T): Promise<string[]> {
  return await executeCommand(this, createCommand(), tryReplyToStringArray);
}

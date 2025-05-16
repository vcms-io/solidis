import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand() {
  return ['SYNC'];
}

export async function sync<T>(this: T): Promise<string> {
  return await executeCommand(this, createCommand(), tryReplyToString);
}

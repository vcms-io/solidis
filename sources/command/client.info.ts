import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand() {
  return ['CLIENT', 'INFO'];
}

export async function clientInfo<T>(this: T): Promise<string> {
  return await executeCommand(this, createCommand(), tryReplyToString);
}

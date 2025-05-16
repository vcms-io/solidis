import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand() {
  return ['COMMAND', 'COUNT'];
}

export async function commandCount<T>(this: T): Promise<number> {
  return await executeCommand(this, createCommand(), tryReplyNumber);
}

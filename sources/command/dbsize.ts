import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand() {
  return ['DBSIZE'];
}

export async function dbsize<T>(this: T): Promise<number> {
  return await executeCommand(this, createCommand(), tryReplyNumber);
}

import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand() {
  return ['SLOWLOG', 'LEN'];
}

export async function slowlogLen<T>(this: T): Promise<number> {
  return await executeCommand(this, createCommand(), tryReplyNumber);
}

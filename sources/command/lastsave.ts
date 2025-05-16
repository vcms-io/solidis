import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand() {
  return ['LASTSAVE'];
}

export async function lastsave<T>(this: T): Promise<number> {
  return await executeCommand(this, createCommand(), tryReplyNumber);
}

import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand() {
  return ['CLIENT', 'ID'];
}

export async function clientId<T>(this: T): Promise<number> {
  return await executeCommand(this, createCommand(), tryReplyNumber);
}

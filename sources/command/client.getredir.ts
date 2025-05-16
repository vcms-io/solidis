import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand() {
  return ['CLIENT', 'GETREDIR'];
}

export async function clientGetredir<T>(this: T): Promise<number> {
  return await executeCommand(this, createCommand(), tryReplyNumber);
}

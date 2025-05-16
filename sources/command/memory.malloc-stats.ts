import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand() {
  return ['MEMORY', 'MALLOC-STATS'];
}

export async function memoryMallocStats<T>(this: T): Promise<string> {
  return await executeCommand(this, createCommand(), tryReplyToString);
}

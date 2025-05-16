import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand() {
  return ['FUNCTION', 'DUMP'];
}

export async function functionDump<T>(this: T): Promise<string> {
  return await executeCommand(this, createCommand(), tryReplyToString);
}

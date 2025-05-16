import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand() {
  return ['MEMORY', 'DOCTOR'];
}

export async function memoryDoctor<T>(this: T): Promise<string> {
  return await executeCommand(this, createCommand(), tryReplyToString);
}

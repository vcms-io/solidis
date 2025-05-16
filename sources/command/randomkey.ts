import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

export function createCommand() {
  return ['RANDOMKEY'];
}

export async function randomkey<T>(this: T): Promise<string | null> {
  return await executeCommand(this, createCommand(), tryReplyToStringOrNull);
}

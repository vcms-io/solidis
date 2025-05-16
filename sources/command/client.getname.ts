import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

export function createCommand() {
  return ['CLIENT', 'GETNAME'];
}

export async function clientGetname<T>(this: T): Promise<string | null> {
  return await executeCommand(this, createCommand(), tryReplyToStringOrNull);
}

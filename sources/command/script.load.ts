import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand(script: string) {
  return ['SCRIPT', 'LOAD', script];
}

export async function scriptLoad<T>(this: T, script: string): Promise<string> {
  return await executeCommand(this, createCommand(script), tryReplyToString);
}

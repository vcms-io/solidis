import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand(message: string) {
  return ['ECHO', message];
}

export async function echo<T>(this: T, message: string): Promise<string> {
  return await executeCommand(this, createCommand(message), tryReplyToString);
}

import { executeCommand, tryReplyToNumber } from './utils/index.ts';

export function createCommand(key: string) {
  return ['BF.CARD', key];
}

export async function bfCard<T>(this: T, key: string): Promise<number> {
  return await executeCommand(this, createCommand(key), tryReplyToNumber);
}

import { executeCommand, tryReplyNumberOrNull } from './utils/index.ts';

export function createCommand(key: string) {
  return ['OBJECT', 'FREQ', key];
}

export async function objectFreq<T>(
  this: T,
  key: string,
): Promise<number | null> {
  return await executeCommand(this, createCommand(key), tryReplyNumberOrNull);
}

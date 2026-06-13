import { executeCommand, tryReplyNumberOrNull } from './utils/index.ts';

export function createCommand(key: string) {
  return ['OBJECT', 'IDLETIME', key];
}

export async function objectIdletime<T>(
  this: T,
  key: string,
): Promise<number | null> {
  return await executeCommand(this, createCommand(key), tryReplyNumberOrNull);
}

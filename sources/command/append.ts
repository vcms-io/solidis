import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, value: string) {
  return ['APPEND', key, value];
}

export async function append<T>(this: T, key: string, value: string) {
  return await executeCommand(this, createCommand(key, value), tryReplyNumber);
}

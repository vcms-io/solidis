import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, member: string) {
  return ['SISMEMBER', key, member];
}

export async function sismember<T>(
  this: T,
  key: string,
  member: string,
): Promise<number> {
  return await executeCommand(this, createCommand(key, member), tryReplyNumber);
}

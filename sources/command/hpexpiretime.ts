import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, field: string) {
  return ['HPEXPIRETIME', key, field];
}

export async function hpexpiretime<T>(
  this: T,
  key: string,
  field: string,
): Promise<number> {
  return await executeCommand(this, createCommand(key, field), tryReplyNumber);
}

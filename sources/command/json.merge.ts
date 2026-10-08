import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(key: string, value: string, path?: string) {
  return ['JSON.MERGE', key, path ?? '$', value];
}

export async function jsonMerge<T>(
  this: T,
  key: string,
  value: string,
  path?: string,
) {
  return await executeCommand(
    this,
    createCommand(key, value, path),
    tryReplyOK,
  );
}

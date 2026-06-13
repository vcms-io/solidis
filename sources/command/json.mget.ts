import {
  executeCommand,
  tryReplyToNullableStringArray,
} from './utils/index.ts';

export function createCommand(keys: string[], path: string) {
  return ['JSON.MGET', ...keys, path];
}

export async function jsonMget<T>(
  this: T,
  keys: string[],
  path: string,
): Promise<Array<string | null>> {
  return await executeCommand(
    this,
    createCommand(keys, path),
    tryReplyToNullableStringArray,
  );
}

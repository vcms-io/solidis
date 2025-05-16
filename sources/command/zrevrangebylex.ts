import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(key: string, max: string, min: string) {
  return ['ZREVRANGEBYLEX', key, max, min];
}

export async function zrevrangebylex<T>(
  this: T,
  key: string,
  max: string,
  min: string,
): Promise<string[]> {
  return await executeCommand(
    this,
    createCommand(key, max, min),
    tryReplyToStringArray,
  );
}

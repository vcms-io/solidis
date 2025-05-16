import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(key: string, max: number, min: number) {
  return ['ZREVRANGEBYSCORE', key, `${max}`, `${min}`];
}

export async function zrevrangebyscore<T>(
  this: T,
  key: string,
  max: number,
  min: number,
): Promise<string[]> {
  return await executeCommand(
    this,
    createCommand(key, max, min),
    tryReplyToStringArray,
  );
}

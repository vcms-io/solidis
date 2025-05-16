import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(key: string, start: number, stop: number) {
  return ['ZREVRANGE', key, `${start}`, `${stop}`];
}

export async function zrevrange<T>(
  this: T,
  key: string,
  start: number,
  stop: number,
): Promise<string[]> {
  return await executeCommand(
    this,
    createCommand(key, start, stop),
    tryReplyToStringArray,
  );
}

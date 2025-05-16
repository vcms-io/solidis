import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(key: string, start: number, stop: number) {
  return ['LRANGE', key, `${start}`, `${stop}`];
}

export async function lrange<T>(
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

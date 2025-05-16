import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, min: number, max: number) {
  return ['ZCOUNT', key, `${min}`, `${max}`];
}

export async function zcount<T>(
  this: T,
  key: string,
  min: number,
  max: number,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, min, max),
    tryReplyNumber,
  );
}

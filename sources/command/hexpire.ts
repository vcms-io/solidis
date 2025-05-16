import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, field: string, seconds: number) {
  return ['HEXPIRE', key, field, `${seconds}`];
}

export async function hexpire<T>(
  this: T,
  key: string,
  field: string,
  seconds: number,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, field, seconds),
    tryReplyNumber,
  );
}

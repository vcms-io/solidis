import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, field: string, timestamp: number) {
  return ['HEXPIREAT', key, field, `${timestamp}`];
}

export async function hexpireat<T>(
  this: T,
  key: string,
  field: string,
  timestamp: number,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, field, timestamp),
    tryReplyNumber,
  );
}

import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(
  key: string,
  fromTimestamp: number,
  toTimestamp: number,
) {
  return ['TS.DEL', key, `${fromTimestamp}`, `${toTimestamp}`];
}

export async function tsDel<T>(
  this: T,
  key: string,
  fromTimestamp: number,
  toTimestamp: number,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, fromTimestamp, toTimestamp),
    tryReplyNumber,
  );
}

import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { CommandTimeSeriesTimestamp } from '../index.ts';

export function createCommand(
  key: string,
  fromTimestamp: CommandTimeSeriesTimestamp,
  toTimestamp: CommandTimeSeriesTimestamp,
) {
  return ['TS.DEL', key, `${fromTimestamp}`, `${toTimestamp}`];
}

export async function tsDel<T>(
  this: T,
  key: string,
  fromTimestamp: CommandTimeSeriesTimestamp,
  toTimestamp: CommandTimeSeriesTimestamp,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, fromTimestamp, toTimestamp),
    tryReplyNumber,
  );
}

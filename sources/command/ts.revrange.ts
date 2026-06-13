import {
  buildTimeSeriesRangeCommand,
  executeCommand,
  tryReplyToTimeSeriesSamples,
} from './utils/index.ts';

import type { CommandTimeSeriesRangeOptions } from '../index.ts';

export function createCommand(
  key: string,
  fromTimestamp: number,
  toTimestamp: number,
  options: CommandTimeSeriesRangeOptions,
) {
  const baseCommand = [
    'TS.REVRANGE',
    key,
    `${fromTimestamp}`,
    `${toTimestamp}`,
  ];

  return buildTimeSeriesRangeCommand(baseCommand, options);
}

export async function tsRevrange<T>(
  this: T,
  key: string,
  fromTimestamp: number,
  toTimestamp: number,
  options: CommandTimeSeriesRangeOptions = {},
): Promise<Array<{ timestamp: number; value: number }>> {
  return await executeCommand(
    this,
    createCommand(key, fromTimestamp, toTimestamp, options),
    tryReplyToTimeSeriesSamples,
  );
}

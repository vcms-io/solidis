import {
  buildTimeSeriesRangeCommand,
  executeCommand,
  tryReplyToTimeSeriesSamples,
} from './utils/index.ts';

import type {
  CommandTimeSeriesRangeOptions,
  CommandTimeSeriesRangeParameters,
  CommandTimeSeriesTimestamp,
} from '../index.ts';

export function createCommand(
  key: string,
  fromTimestamp: CommandTimeSeriesTimestamp,
  toTimestamp: CommandTimeSeriesTimestamp,
  options: CommandTimeSeriesRangeOptions,
) {
  const baseCommand = ['TS.RANGE', key, `${fromTimestamp}`, `${toTimestamp}`];

  return buildTimeSeriesRangeCommand(baseCommand, options);
}

export async function tsRange<T>(
  this: T,
  key: string,
  ...parameters: CommandTimeSeriesRangeParameters
): Promise<Array<{ timestamp: number; value: number }>>;
export async function tsRange<T>(
  this: T,
  key: string,
  fromTimestamp: CommandTimeSeriesTimestamp,
  toTimestamp: CommandTimeSeriesTimestamp,
  options: CommandTimeSeriesRangeOptions = {},
): Promise<Array<{ timestamp: number; value: number }>> {
  return await executeCommand(
    this,
    createCommand(key, fromTimestamp, toTimestamp, options),
    tryReplyToTimeSeriesSamples,
  );
}

import {
  buildTimeSeriesRangeCommand,
  executeCommand,
  tryReplyToTimeSeriesMultiRangeResults,
} from './utils/index.ts';

import type {
  CommandTimeSeriesRangeOptions,
  CommandTimeSeriesTimestamp,
} from '../index.ts';

export function createCommand(
  fromTimestamp: CommandTimeSeriesTimestamp,
  toTimestamp: CommandTimeSeriesTimestamp,
  filter: Record<string, string>,
  options: CommandTimeSeriesRangeOptions,
) {
  const baseCommand = ['TS.MRANGE', `${fromTimestamp}`, `${toTimestamp}`];
  const command = buildTimeSeriesRangeCommand(baseCommand, options);

  command.push('FILTER');

  for (const [label, value] of Object.entries(filter)) {
    command.push(`${label}=${value}`);
  }

  return command;
}

export async function tsMrange<T>(
  this: T,
  fromTimestamp: CommandTimeSeriesTimestamp,
  toTimestamp: CommandTimeSeriesTimestamp,
  filter: Record<string, string>,
  options: CommandTimeSeriesRangeOptions = {},
): Promise<
  Array<{
    key: string;
    samples: Array<{ timestamp: number; value: number }>;
  }>
> {
  return await executeCommand(
    this,
    createCommand(fromTimestamp, toTimestamp, filter, options),
    tryReplyToTimeSeriesMultiRangeResults,
  );
}

import { formatInteger } from '../common/utils/internal.ts';
import {
  buildTimeSeriesRangeCommand,
  executeCommand,
  tryReplyToTimeSeriesMultiRangeResults,
} from './utils/index.ts';

import type {
  CommandTimeSeriesRangeOptions,
  CommandTimeSeriesRangeParameters,
  CommandTimeSeriesTimestamp,
} from '../index.ts';

export function createCommand(
  fromTimestamp: CommandTimeSeriesTimestamp,
  toTimestamp: CommandTimeSeriesTimestamp,
  filter: Record<string, string>,
  options: CommandTimeSeriesRangeOptions,
) {
  const baseCommand = [
    'TS.MREVRANGE',
    formatInteger(fromTimestamp),
    formatInteger(toTimestamp),
  ];
  const command = buildTimeSeriesRangeCommand(baseCommand, options);

  command.push('FILTER');

  for (const [label, value] of Object.entries(filter)) {
    command.push(`${label}=${value}`);
  }

  return command;
}

export async function tsMrevrange<T>(
  this: T,
  ...parameters: CommandTimeSeriesRangeParameters<
    [filter: Record<string, string>]
  >
): Promise<
  Array<{
    key: string;
    samples: Array<{ timestamp: number; value: number }>;
  }>
>;
export async function tsMrevrange<T>(
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

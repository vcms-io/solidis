import { formatInteger } from '../common/utils/internal.ts';
import {
  buildTimeSeriesCommand,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

import type {
  CommandTimeSeriesAddOptions,
  CommandTimeSeriesSampleTimestamp,
} from '../index.ts';

export function createCommand(
  key: string,
  timestamp: CommandTimeSeriesSampleTimestamp,
  value: number,
  options: CommandTimeSeriesAddOptions,
) {
  return buildTimeSeriesCommand(
    ['TS.ADD', key, formatInteger(timestamp), `${value}`],
    options,
  );
}

export async function tsAdd<T>(
  this: T,
  key: string,
  timestamp: CommandTimeSeriesSampleTimestamp,
  value: number,
  options: CommandTimeSeriesAddOptions = {},
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, timestamp, value, options),
    tryReplyNumber,
  );
}

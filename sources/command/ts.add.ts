import {
  buildTimeSeriesCommand,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

import type { CommandTimeSeriesAddOptions } from '../index.ts';

export function createCommand(
  key: string,
  timestamp: number,
  value: number,
  options: CommandTimeSeriesAddOptions,
) {
  return buildTimeSeriesCommand(
    ['TS.ADD', key, `${timestamp}`, `${value}`],
    options,
  );
}

export async function tsAdd<T>(
  this: T,
  key: string,
  timestamp: number,
  value: number,
  options: CommandTimeSeriesAddOptions = {},
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, timestamp, value, options),
    tryReplyNumber,
  );
}

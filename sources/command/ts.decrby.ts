import {
  buildTimeSeriesCommand,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

import type { CommandTimeSeriesIncrDecrOptions } from '../index.ts';

export function createCommand(
  key: string,
  decrement: number,
  options: CommandTimeSeriesIncrDecrOptions,
) {
  return buildTimeSeriesCommand(['TS.DECRBY', key, `${decrement}`], options);
}

export async function tsDecrby<T>(
  this: T,
  key: string,
  decrement: number,
  options: CommandTimeSeriesIncrDecrOptions = {},
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, decrement, options),
    tryReplyNumber,
  );
}

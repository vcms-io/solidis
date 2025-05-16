import {
  buildTimeSeriesCommand,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

import type { CommandTimeSeriesIncrDecrOptions } from '../index.ts';

export function createCommand(
  key: string,
  increment: number,
  options: CommandTimeSeriesIncrDecrOptions,
) {
  return buildTimeSeriesCommand(['TS.INCRBY', key, `${increment}`], options);
}

export async function tsIncrby<T>(
  this: T,
  key: string,
  increment: number,
  options: CommandTimeSeriesIncrDecrOptions = {},
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, increment, options),
    tryReplyNumber,
  );
}

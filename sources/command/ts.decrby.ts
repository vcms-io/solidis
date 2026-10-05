import { formatInteger } from '../common/utils/internal.ts';
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
  const command = ['TS.DECRBY', key, `${decrement}`];

  if (options.timestamp !== undefined) {
    command.push('TIMESTAMP', formatInteger(options.timestamp));
  }

  return buildTimeSeriesCommand(command, options);
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

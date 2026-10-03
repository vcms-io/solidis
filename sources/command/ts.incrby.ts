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
  const command = ['TS.INCRBY', key, `${increment}`];

  if (options.timestamp !== undefined) {
    command.push('TIMESTAMP', `${options.timestamp}`);
  }

  return buildTimeSeriesCommand(command, options);
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

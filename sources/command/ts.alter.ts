import {
  buildTimeSeriesCommand,
  executeCommand,
  tryReplyOK,
} from './utils/index.ts';

import type { CommandTimeSeriesAlterOptions } from '../index.ts';

export function createCommand(
  key: string,
  options: CommandTimeSeriesAlterOptions,
) {
  return buildTimeSeriesCommand(['TS.ALTER', key], options);
}

export async function tsAlter<T>(
  this: T,
  key: string,
  options: CommandTimeSeriesAlterOptions = {},
) {
  return await executeCommand(this, createCommand(key, options), tryReplyOK);
}

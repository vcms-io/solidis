import {
  buildTimeSeriesCommand,
  executeCommand,
  tryReplyOK,
} from './utils/index.ts';

import type { CommandTimeSeriesCreateOptions } from '../index.ts';

export function createCommand(
  key: string,
  options: CommandTimeSeriesCreateOptions,
) {
  return buildTimeSeriesCommand(['TS.CREATE', key], options);
}

export async function tsCreate<T>(
  this: T,
  key: string,
  options: CommandTimeSeriesCreateOptions = {},
) {
  return await executeCommand(this, createCommand(key, options), tryReplyOK);
}

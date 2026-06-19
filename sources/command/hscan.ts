import {
  buildScanCommand,
  createScanIterator,
  tryReplyToStringRecord,
} from './utils/index.ts';

import type { CommandScanBaseOptions, RespHashField } from '../index.ts';

export function createCommand(
  key: string,
  cursor: string,
  options: CommandScanBaseOptions,
) {
  return buildScanCommand(['HSCAN', key], cursor, options);
}

export async function* hscan<T>(
  this: T,
  key: string,
  options: CommandScanBaseOptions = {},
): AsyncGenerator<RespHashField> {
  yield* createScanIterator(
    this,
    ['HSCAN', key],
    options,
    tryReplyToStringRecord,
  );
}

import {
  buildScanCommand,
  createScanIterator,
  tryReplyToStringArray,
} from './utils/index.ts';

import type { CommandScanOptions } from '../index.ts';

export function createCommand(cursor: string, options: CommandScanOptions) {
  return buildScanCommand(['SCAN'], cursor, options);
}

export async function* scan<T>(
  this: T,
  options: CommandScanOptions = {},
): AsyncGenerator<string[]> {
  yield* createScanIterator(this, ['SCAN'], options, tryReplyToStringArray);
}

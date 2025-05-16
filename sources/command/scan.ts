import {
  buildScanCommand,
  executeCommand,
  tryReplyToScan,
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
  let cursor = '0';
  const { count = 10, match, type } = options;

  do {
    const command = createCommand(cursor, { count, match, type });

    const reply = await executeCommand(this, command);

    const [newCursor, elements] = tryReplyToScan(reply);
    cursor = newCursor;

    yield tryReplyToStringArray(elements, command);
  } while (cursor !== '0');
}

import {
  buildScanCommand,
  executeCommand,
  tryReplyToScan,
  tryReplyToStringArray,
} from './utils/index.ts';

import type { CommandScanBaseOptions } from '../index.ts';

export function createCommand(
  key: string,
  cursor: string,
  options: CommandScanBaseOptions,
) {
  return buildScanCommand(['SSCAN', key], cursor, options);
}

export async function* sscan<T>(
  this: T,
  key: string,
  options: CommandScanBaseOptions = {},
): AsyncGenerator<string[]> {
  let cursor = '0';
  const { count = 10, match } = options;

  do {
    const command = createCommand(key, cursor, { count, match });

    const reply = await executeCommand(this, command);

    const [newCursor, elements] = tryReplyToScan(reply);
    cursor = newCursor;

    yield tryReplyToStringArray(elements, command);
  } while (cursor !== '0');
}

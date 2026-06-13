import {
  buildScanCommand,
  executeCommand,
  tryReplyToScan,
  tryReplyToSortedSetMembers,
} from './utils/index.ts';

import type { CommandScanBaseOptions, RespSortedSetMember } from '../index.ts';

export function createCommand(
  key: string,
  cursor: string,
  options: CommandScanBaseOptions = {},
) {
  return buildScanCommand(['ZSCAN', key], cursor, options);
}

export async function* zscan<T>(
  this: T,
  key: string,
  options: CommandScanBaseOptions = {},
): AsyncGenerator<RespSortedSetMember[]> {
  let cursor = '0';
  const { count = 10, match } = options;

  do {
    const command = createCommand(key, cursor, { count, match });

    const reply = await executeCommand(this, command);

    const [newCursor, elements] = tryReplyToScan(reply);
    cursor = newCursor;

    yield tryReplyToSortedSetMembers(elements, command);
  } while (cursor !== '0');
}

import {
  buildScanCommand,
  executeCommand,
  processPairedArray,
  tryReplyToNumber,
  tryReplyToScan,
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

    const result: RespSortedSetMember[] = [];

    processPairedArray(
      elements,
      (member, score) => {
        result.push({
          member,
          score: tryReplyToNumber(score, command),
        });
      },
      'ZSCAN',
    );

    yield result;
  } while (cursor !== '0');
}

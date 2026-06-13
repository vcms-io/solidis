import {
  buildScanCommand,
  executeCommand,
  tryReplyToScan,
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
  let cursor = '0';
  const { count = 10, match } = options;

  do {
    const command = createCommand(key, cursor, { count, match });

    const reply = await executeCommand(this, command);

    const [newCursor, elements] = tryReplyToScan(reply);
    cursor = newCursor;

    yield tryReplyToStringRecord(elements, 'HSCAN');
  } while (cursor !== '0');
}

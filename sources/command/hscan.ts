import {
  buildScanCommand,
  executeCommand,
  processPairedArray,
  tryReplyToScan,
  tryReplyToString,
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

    const result: Record<string, string> = {};

    processPairedArray(
      elements,
      (field, value) => {
        result[field] = tryReplyToString(value, command);
      },
      'HSCAN',
    );

    yield result;
  } while (cursor !== '0');
}

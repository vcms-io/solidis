import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyToJsonNumbers } from './utils/index.ts';

import type { CommandJsonArrTrimOptions } from '../index.ts';

export function createCommand(
  key: string,
  path: string,
  options: CommandJsonArrTrimOptions,
) {
  return [
    'JSON.ARRTRIM',
    key,
    path,
    formatInteger(options.start),
    formatInteger(options.stop),
  ];
}

export async function jsonArrtrim<T>(
  this: T,
  key: string,
  path: string,
  options: CommandJsonArrTrimOptions,
): Promise<(number | null)[]> {
  return await executeCommand(
    this,
    createCommand(key, path, options),
    tryReplyToJsonNumbers,
  );
}

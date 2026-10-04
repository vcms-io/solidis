import { inspect } from 'node:util';

import type { SolidisDebugLog } from '../../types/solidis.ts';

export function formatDebugLog(
  entry: Pick<SolidisDebugLog, 'type' | 'message' | 'data'>,
): string {
  const data =
    entry.data === undefined
      ? ''
      : ` ${inspect(entry.data, { breakLength: Number.POSITIVE_INFINITY })}`;

  return `[Solidis ${entry.type}] ${entry.message}${data}\n`;
}

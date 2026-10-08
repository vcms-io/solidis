import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, maxlen: number) {
  return ['XTRIM', key, 'MAXLEN', formatInteger(maxlen)];
}

export async function xtrim<T>(
  this: T,
  key: string,
  maxlen: number,
): Promise<number> {
  return await executeCommand(this, createCommand(key, maxlen), tryReplyNumber);
}

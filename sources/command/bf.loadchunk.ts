import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(key: string, iterator: number, data: Buffer) {
  return ['BF.LOADCHUNK', key, formatInteger(iterator), data];
}

export async function bfLoadchunk<T>(
  this: T,
  key: string,
  iterator: number,
  data: Buffer,
) {
  return await executeCommand(
    this,
    createCommand(key, iterator, data),
    tryReplyOK,
  );
}

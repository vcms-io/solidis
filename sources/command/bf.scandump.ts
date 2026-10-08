import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyToScanDump } from './utils/index.ts';

export function createCommand(key: string, iterator: number) {
  return ['BF.SCANDUMP', key, formatInteger(iterator)];
}

export async function bfScandump<T>(
  this: T,
  key: string,
  iterator: number,
): Promise<[nextIterator: number, data: Buffer]> {
  return await executeCommand(
    this,
    createCommand(key, iterator),
    tryReplyToScanDump,
  );
}

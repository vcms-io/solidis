import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(index1: number, index2: number) {
  return ['SWAPDB', formatInteger(index1), formatInteger(index2)];
}

export async function swapdb<T>(this: T, index1: number, index2: number) {
  return await executeCommand(this, createCommand(index1, index2), tryReplyOK);
}

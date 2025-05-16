import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(index1: number, index2: number) {
  return ['SWAPDB', `${index1}`, `${index2}`];
}

export async function swapdb<T>(this: T, index1: number, index2: number) {
  return await executeCommand(this, createCommand(index1, index2), tryReplyOK);
}

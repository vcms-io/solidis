import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(key: string, index: number, element: string) {
  return ['LSET', key, `${index}`, element];
}

export async function lset<T>(
  this: T,
  key: string,
  index: number,
  element: string,
) {
  return await executeCommand(
    this,
    createCommand(key, index, element),
    tryReplyOK,
  );
}

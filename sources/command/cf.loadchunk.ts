import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(key: string, iterator: number, data: Buffer) {
  return ['CF.LOADCHUNK', key, `${iterator}`, data];
}

export async function cfLoadchunk<T>(
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

import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(destkey: string, sourcekeys: string[]) {
  return ['PFMERGE', destkey, ...sourcekeys];
}

export async function pfmerge<T>(
  this: T,
  destkey: string,
  sourcekeys: string[],
) {
  return await executeCommand(
    this,
    createCommand(destkey, sourcekeys),
    tryReplyOK,
  );
}

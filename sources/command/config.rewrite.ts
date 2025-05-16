import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand() {
  return ['CONFIG', 'REWRITE'];
}

export async function configRewrite<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyOK);
}

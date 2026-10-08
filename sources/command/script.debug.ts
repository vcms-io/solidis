import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(mode: 'NO') {
  return ['SCRIPT', 'DEBUG', mode];
}

export async function scriptDebug<T>(this: T, mode: 'NO') {
  return await executeCommand(this, createCommand(mode), tryReplyOK);
}

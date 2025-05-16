import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand() {
  return ['CONFIG', 'RESETSTAT'];
}

export async function configResetstat<T>(this: T) {
  return await executeCommand(this, createCommand(), tryReplyOK);
}

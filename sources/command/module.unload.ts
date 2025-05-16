import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(name: string) {
  return ['MODULE', 'UNLOAD', name];
}

export async function moduleUnload<T>(this: T, name: string) {
  return await executeCommand(this, createCommand(name), tryReplyOK);
}

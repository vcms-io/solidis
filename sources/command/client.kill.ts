import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(id: number) {
  return ['CLIENT', 'KILL', 'ID', `${id}`];
}

export async function clientKill<T>(this: T, id: number) {
  return await executeCommand(this, createCommand(id), tryReplyOK);
}

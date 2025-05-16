import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(host: string, port: number) {
  return ['REPLICAOF', host, `${port}`];
}

export async function replicaof<T>(this: T, host: string, port: number) {
  return await executeCommand(this, createCommand(host, port), tryReplyOK);
}

import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(connectionName: string) {
  return ['CLIENT', 'SETNAME', connectionName];
}

export async function clientSetname<T>(this: T, connectionName: string) {
  return await executeCommand(this, createCommand(connectionName), tryReplyOK);
}

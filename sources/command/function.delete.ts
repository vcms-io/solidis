import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(library: string) {
  return ['FUNCTION', 'DELETE', library];
}

export async function functionDelete<T>(this: T, library: string) {
  return await executeCommand(this, createCommand(library), tryReplyOK);
}

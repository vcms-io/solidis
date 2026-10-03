import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(async?: boolean) {
  const command = ['FUNCTION', 'FLUSH'];

  if (async !== undefined) {
    command.push(async ? 'ASYNC' : 'SYNC');
  }

  return command;
}

export async function functionFlush<T>(this: T, async?: boolean) {
  return await executeCommand(this, createCommand(async), tryReplyOK);
}

import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string) {
  return ['OBJECT', 'REFCOUNT', key];
}

export async function objectRefcount<T>(
  this: T,
  key: string,
): Promise<number | null> {
  return await executeCommand(this, createCommand(key), (reply, command) => {
    if (reply === null) {
      return null;
    }

    return tryReplyNumber(reply, command);
  });
}

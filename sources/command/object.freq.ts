import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string) {
  return ['OBJECT', 'FREQ', key];
}

export async function objectFreq<T>(
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

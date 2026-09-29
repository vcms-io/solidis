import { executeCommand, newUnexpectedReplyError } from './utils/index.ts';

export function createCommand(key: string) {
  return ['GET', key];
}

export async function getBuffer<T>(
  this: T,
  key: string,
): Promise<Buffer | null> {
  return await executeCommand(this, createCommand(key), (reply, command) => {
    if (reply === null) {
      return null;
    }

    if (reply instanceof Buffer) {
      return reply;
    }

    throw newUnexpectedReplyError(reply, command);
  });
}

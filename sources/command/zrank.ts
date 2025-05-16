import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, member: string) {
  return ['ZRANK', key, member];
}

export async function zrank<T>(
  this: T,
  key: string,
  member: string,
): Promise<number | null> {
  return await executeCommand(
    this,
    createCommand(key, member),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      return tryReplyNumber(reply, command);
    },
  );
}

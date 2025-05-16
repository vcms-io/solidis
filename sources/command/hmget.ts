import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(key: string, ...fields: string[]) {
  return ['HMGET', key, ...fields];
}

export async function hmget<T>(
  this: T,
  key: string,
  ...fields: string[]
): Promise<(string | null)[]> {
  return await executeCommand(
    this,
    createCommand(key, ...fields),
    (reply, command) => tryReplyToStringArray(reply, command, true),
  );
}

import { executeCommand, tryReplyNumberOrNull } from './utils/index.ts';

export function createCommand(key: string, member: string) {
  return ['ZREVRANK', key, member];
}

export async function zrevrank<T>(
  this: T,
  key: string,
  member: string,
): Promise<number | null> {
  return await executeCommand(
    this,
    createCommand(key, member),
    tryReplyNumberOrNull,
  );
}

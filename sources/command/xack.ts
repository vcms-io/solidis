import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, group: string, ids: string[]) {
  return ['XACK', key, group, ...ids];
}

export async function xack<T>(
  this: T,
  key: string,
  group: string,
  ids: string[],
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, group, ids),
    tryReplyNumber,
  );
}

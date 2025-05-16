import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, ...fields: string[]) {
  return ['HDEL', key, ...fields];
}

export async function hdel<T>(
  this: T,
  key: string,
  ...fields: string[]
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, ...fields),
    tryReplyNumber,
  );
}

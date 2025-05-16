import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, ...members: string[]) {
  return ['SREM', key, ...members];
}

export async function srem<T>(
  this: T,
  key: string,
  ...members: string[]
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, ...members),
    tryReplyNumber,
  );
}

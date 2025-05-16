import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, seconds: number) {
  return ['EXPIRE', key, `${seconds}`];
}

export async function expire<T>(
  this: T,
  key: string,
  seconds: number,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, seconds),
    tryReplyNumber,
  );
}

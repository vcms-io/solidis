import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, increment: number) {
  return ['INCRBY', key, `${increment}`];
}

export async function incrby<T>(
  this: T,
  key: string,
  increment: number,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, increment),
    tryReplyNumber,
  );
}

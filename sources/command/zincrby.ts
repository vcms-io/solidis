import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, increment: number, member: string) {
  return ['ZINCRBY', key, `${increment}`, member];
}

export async function zincrby<T>(
  this: T,
  key: string,
  increment: number,
  member: string,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, increment, member),
    tryReplyNumber,
  );
}

import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, score: number, member: string) {
  return ['ZADD', key, `${score}`, member];
}

export async function zadd<T>(
  this: T,
  key: string,
  score: number,
  member: string,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, score, member),
    tryReplyNumber,
  );
}

import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, ...members: string[]) {
  return ['SADD', key, ...members];
}

export async function sadd<T>(
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

import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, decrement: number) {
  return ['DECRBY', key, `${decrement}`];
}

export async function decrby<T>(
  this: T,
  key: string,
  decrement: number,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, decrement),
    tryReplyNumber,
  );
}

import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, db: number) {
  return ['MOVE', key, `${db}`];
}

export async function move<T>(
  this: T,
  key: string,
  db: number,
): Promise<number> {
  return await executeCommand(this, createCommand(key, db), tryReplyNumber);
}

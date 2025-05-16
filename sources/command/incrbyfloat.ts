import { executeCommand, tryReplyToNumber } from './utils/index.ts';

export function createCommand(key: string, increment: number) {
  return ['INCRBYFLOAT', key, `${increment}`];
}

export async function incrbyfloat<T>(
  this: T,
  key: string,
  increment: number,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, increment),
    tryReplyToNumber,
  );
}

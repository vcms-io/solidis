import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, field: string, increment: number) {
  return ['HINCRBY', key, field, `${increment}`];
}

export async function hincrby<T>(
  this: T,
  key: string,
  field: string,
  increment: number,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, field, increment),
    tryReplyNumber,
  );
}

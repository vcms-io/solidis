import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, count: number, element: string) {
  return ['LREM', key, `${count}`, element];
}

export async function lrem<T>(
  this: T,
  key: string,
  count: number,
  element: string,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, count, element),
    tryReplyNumber,
  );
}

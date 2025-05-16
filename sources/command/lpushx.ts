import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, elements: string[]) {
  return ['LPUSHX', key, ...elements];
}

export async function lpushx<T>(
  this: T,
  key: string,
  elements: string[],
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, elements),
    tryReplyNumber,
  );
}

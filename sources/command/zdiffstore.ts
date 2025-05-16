import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(destination: string, keys: string[]) {
  return ['ZDIFFSTORE', destination, `${keys.length}`, ...keys];
}

export async function zdiffstore<T>(
  this: T,
  destination: string,
  keys: string[],
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(destination, keys),
    tryReplyNumber,
  );
}

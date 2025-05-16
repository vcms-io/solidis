import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(destination: string, keys: string[]) {
  return ['SDIFFSTORE', destination, ...keys];
}

export async function sdiffstore<T>(
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

import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(destination: string, keys: string[]) {
  return ['SINTERSTORE', destination, ...keys];
}

export async function sinterstore<T>(
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

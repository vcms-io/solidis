import { executeCommand, tryReplyToBoolean } from './utils/index.ts';

export function createCommand(key: string, item: string) {
  return ['BF.ADD', key, item];
}

export async function bfAdd<T>(
  this: T,
  key: string,
  item: string,
): Promise<boolean> {
  return await executeCommand(
    this,
    createCommand(key, item),
    tryReplyToBoolean,
  );
}

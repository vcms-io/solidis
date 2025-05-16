import { executeCommand, tryReplyToBoolean } from './utils/index.ts';

export function createCommand(key: string, item: string) {
  return ['CF.EXISTS', key, item];
}

export async function cfExists<T>(
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

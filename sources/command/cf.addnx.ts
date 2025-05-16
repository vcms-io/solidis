import { executeCommand, tryReplyToBoolean } from './utils/index.ts';

export function createCommand(key: string, item: string) {
  return ['CF.ADDNX', key, item];
}

export async function cfAddnx<T>(
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

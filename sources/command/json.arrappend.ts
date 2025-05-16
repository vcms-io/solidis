import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

export function createCommand(key: string, path: string, ...values: string[]) {
  return ['JSON.ARRAPPEND', key, path, ...values];
}

export async function jsonArrappend<T>(
  this: T,
  key: string,
  path: string,
  ...values: string[]
): Promise<(number | null)[]> {
  return await executeCommand(
    this,
    createCommand(key, path, ...values),
    (reply, command) => tryReplyToNumberArray(reply, command, true),
  );
}

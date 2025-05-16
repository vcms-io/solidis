import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

export function createCommand(
  key: string,
  path: string,
  index: number,
  ...values: string[]
) {
  return ['JSON.ARRINSERT', key, path, `${index}`, ...values];
}

export async function jsonArrinsert<T>(
  this: T,
  key: string,
  path: string,
  index: number,
  ...values: string[]
): Promise<(number | null)[]> {
  return await executeCommand(
    this,
    createCommand(key, path, index, ...values),
    (reply, command) => tryReplyToNumberArray(reply, command, true),
  );
}

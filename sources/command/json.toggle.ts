import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

export function createCommand(key: string, path: string) {
  return ['JSON.TOGGLE', key, path];
}

export async function jsonToggle<T>(
  this: T,
  key: string,
  path: string,
): Promise<(number | null)[]> {
  return await executeCommand(
    this,
    createCommand(key, path),
    (reply, command) => tryReplyToNumberArray(reply, command, true),
  );
}

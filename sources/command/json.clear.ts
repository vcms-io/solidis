import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, path?: string) {
  const command = ['JSON.CLEAR', key];

  if (path !== undefined) {
    command.push(path);
  }

  return command;
}

export async function jsonClear<T>(
  this: T,
  key: string,
  path?: string,
): Promise<number> {
  return await executeCommand(this, createCommand(key, path), tryReplyNumber);
}

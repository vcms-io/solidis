import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(key: string, value: string, path?: string) {
  const command = ['JSON.MERGE', key];

  if (path !== undefined) {
    command.push(path);
  }

  command.push(value);

  return command;
}

export async function jsonMerge<T>(
  this: T,
  key: string,
  value: string,
  path?: string,
) {
  return await executeCommand(
    this,
    createCommand(key, value, path),
    tryReplyOK,
  );
}

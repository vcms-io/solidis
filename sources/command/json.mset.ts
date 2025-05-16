import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(
  items: Array<{ key: string; path: string; value: string }>,
) {
  const command = ['JSON.MSET'];

  for (const { key, path, value } of items) {
    command.push(key, path, value);
  }

  return command;
}

export async function jsonMset<T>(
  this: T,
  items: Array<{ key: string; path: string; value: string }>,
) {
  return await executeCommand(this, createCommand(items), tryReplyOK);
}

import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(keyValues: Record<string, string>) {
  const command = ['MSETNX'];

  for (const [key, value] of Object.entries(keyValues)) {
    command.push(key, value);
  }

  return command;
}

export async function msetnx<T>(
  this: T,
  keyValues: Record<string, string>,
): Promise<number> {
  return await executeCommand(this, createCommand(keyValues), tryReplyNumber);
}

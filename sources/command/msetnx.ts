import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(keyValues: Record<string, StringOrBuffer>) {
  const command: StringOrBuffer[] = ['MSETNX'];

  for (const [key, value] of Object.entries(keyValues)) {
    command.push(key, value);
  }

  return command;
}

export async function msetnx<T>(
  this: T,
  keyValues: Record<string, StringOrBuffer>,
): Promise<number> {
  return await executeCommand(this, createCommand(keyValues), tryReplyNumber);
}

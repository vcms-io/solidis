import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(mapping: Record<string, StringOrBuffer>) {
  const command: StringOrBuffer[] = ['MSET'];

  for (const [key, value] of Object.entries(mapping)) {
    command.push(key, value);
  }

  return command;
}

export async function mset<T>(
  this: T,
  mapping: Record<string, StringOrBuffer>,
) {
  return await executeCommand(this, createCommand(mapping), tryReplyOK);
}

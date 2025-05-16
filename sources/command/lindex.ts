import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

export function createCommand(key: string, index: number) {
  return ['LINDEX', key, `${index}`];
}

export async function lindex<T>(
  this: T,
  key: string,
  index: number,
): Promise<string | null> {
  return await executeCommand(
    this,
    createCommand(key, index),
    tryReplyToStringOrNull,
  );
}

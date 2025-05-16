import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand(key: string, field: string) {
  return ['HGET', key, field];
}

export async function hget<T>(
  this: T,
  key: string,
  field: string,
): Promise<string | null> {
  return await executeCommand(
    this,
    createCommand(key, field),
    tryReplyToString,
  );
}

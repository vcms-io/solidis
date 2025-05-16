import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, field: string) {
  return ['HTTL', key, field];
}

export async function httl<T>(
  this: T,
  key: string,
  field: string,
): Promise<number> {
  return await executeCommand(this, createCommand(key, field), tryReplyNumber);
}

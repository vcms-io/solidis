import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand(key: string, field: string, increment: number) {
  return ['HINCRBYFLOAT', key, field, `${increment}`];
}

export async function hincrbyfloat<T>(
  this: T,
  key: string,
  field: string,
  increment: number,
): Promise<string> {
  return await executeCommand(
    this,
    createCommand(key, field, increment),
    tryReplyToString,
  );
}

import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand(key: string, start: number, end: number) {
  return ['GETRANGE', key, `${start}`, `${end}`];
}

export async function getrange<T>(
  this: T,
  key: string,
  start: number,
  end: number,
): Promise<string> {
  return await executeCommand(
    this,
    createCommand(key, start, end),
    tryReplyToString,
  );
}

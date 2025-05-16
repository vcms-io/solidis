import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, offset: number) {
  return ['GETBIT', key, `${offset}`];
}

export async function getbit<T>(
  this: T,
  key: string,
  offset: number,
): Promise<number> {
  return await executeCommand(this, createCommand(key, offset), tryReplyNumber);
}

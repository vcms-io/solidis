import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { RespBit } from '../index.ts';

export function createCommand(key: string, offset: number, value: RespBit) {
  return ['SETBIT', key, `${offset}`, `${value}`];
}

export async function setbit<T>(
  this: T,
  key: string,
  offset: number,
  value: RespBit,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, offset, value),
    tryReplyNumber,
  );
}

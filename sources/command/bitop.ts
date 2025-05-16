import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { RespBitOperation } from '../index.ts';

export function createCommand(
  operation: RespBitOperation,
  destkey: string,
  keys: string[],
) {
  if (operation === 'NOT' && keys.length !== 1) {
    throw new Error('BITOP NOT accepts exactly one source key');
  }

  return ['BITOP', operation, destkey, ...keys];
}

export async function bitop<T>(
  this: T,
  operation: RespBitOperation,
  destkey: string,
  keys: string[],
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(operation, destkey, keys),
    tryReplyNumber,
  );
}

import { formatInteger } from '../common/utils/internal.ts';
import { executeIntegerCommand } from './utils/index.ts';

import type { CommandIntegerOptions, RespInteger } from '../index.ts';

export function createCommand(key: string, decrement: number | bigint) {
  return ['DECRBY', key, formatInteger(decrement)];
}

export async function decrby<
  T,
  Options extends CommandIntegerOptions | undefined = undefined,
>(
  this: T,
  key: string,
  decrement: number | bigint,
  options?: Options,
): Promise<RespInteger<Options>> {
  return await executeIntegerCommand(
    this,
    createCommand(key, decrement),
    options,
  );
}

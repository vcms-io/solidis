import { formatInteger } from '../common/utils/internal.ts';
import { executeIntegerCommand } from './utils/index.ts';

import type { CommandIntegerOptions, RespInteger } from '../index.ts';

export function createCommand(key: string, increment: number | bigint) {
  return ['INCRBY', key, formatInteger(increment)];
}

export async function incrby<
  T,
  Options extends CommandIntegerOptions | undefined = undefined,
>(
  this: T,
  key: string,
  increment: number | bigint,
  options?: Options,
): Promise<RespInteger<Options>> {
  return await executeIntegerCommand(
    this,
    createCommand(key, increment),
    options,
  );
}

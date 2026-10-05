import { formatInteger } from '../common/utils/internal.ts';
import { executeIntegerCommand } from './utils/index.ts';

import type { CommandIntegerOptions, RespInteger } from '../index.ts';

export function createCommand(
  key: string,
  field: string,
  increment: number | bigint,
) {
  return ['HINCRBY', key, field, formatInteger(increment)];
}

export async function hincrby<
  T,
  Options extends CommandIntegerOptions | undefined = undefined,
>(
  this: T,
  key: string,
  field: string,
  increment: number | bigint,
  options?: Options,
): Promise<RespInteger<Options>> {
  return await executeIntegerCommand(
    this,
    createCommand(key, field, increment),
    options,
  );
}

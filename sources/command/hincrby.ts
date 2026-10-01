import { executeIntegerCommand } from './utils/index.ts';

import type { SolidisInteger } from '../index.ts';

export function createCommand(
  key: string,
  field: string,
  increment: number | bigint,
) {
  return ['HINCRBY', key, field, `${increment}`];
}

export async function hincrby<T>(
  this: T,
  key: string,
  field: string,
  increment: number | bigint,
): Promise<SolidisInteger<T>> {
  return await executeIntegerCommand(
    this,
    createCommand(key, field, increment),
  );
}

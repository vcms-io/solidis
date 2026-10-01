import { executeIntegerCommand } from './utils/index.ts';

import type { SolidisInteger } from '../index.ts';

export function createCommand(key: string, decrement: number | bigint) {
  return ['DECRBY', key, `${decrement}`];
}

export async function decrby<T>(
  this: T,
  key: string,
  decrement: number | bigint,
): Promise<SolidisInteger<T>> {
  return await executeIntegerCommand(this, createCommand(key, decrement));
}

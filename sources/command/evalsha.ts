import { executeCommand } from './utils/index.ts';

import type { SolidisData } from '../index.ts';

export function createCommand(
  sha1: string,
  keys: string[],
  parameters: string[],
) {
  return ['EVALSHA', sha1, `${keys.length}`, ...keys, ...parameters];
}

export async function evalsha<T>(
  this: T,
  sha1: string,
  keys: string[],
  parameters: string[],
): Promise<SolidisData> {
  return await executeCommand(this, createCommand(sha1, keys, parameters));
}

import { executeCommand } from './utils/index.ts';

import type { SolidisData } from '../index.ts';

export function createCommand(
  script: string,
  keys: string[],
  parameters: string[],
) {
  return ['EVAL', script, `${keys.length}`, ...keys, ...parameters];
}

export async function evaluate<T>(
  this: T,
  script: string,
  keys: string[],
  parameters: string[],
): Promise<SolidisData> {
  return await executeCommand(this, createCommand(script, keys, parameters));
}

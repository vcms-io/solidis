import { executeCommand } from './utils/index.ts';

import type { SolidisData } from '../index.ts';

export function createCommand(
  script: string,
  keys: string[],
  parameters: string[],
) {
  return ['EVAL_RO', script, `${keys.length}`, ...keys, ...parameters];
}

export async function evalRo<T>(
  this: T,
  script: string,
  keys: string[],
  parameters: string[],
): Promise<SolidisData> {
  return await executeCommand(this, createCommand(script, keys, parameters));
}

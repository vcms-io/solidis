import { executeCommand } from './utils/index.ts';

import type { SolidisData } from '../index.ts';

export function createCommand(
  functionName: string,
  keys: string[],
  parameters: string[],
) {
  return ['FCALL_RO', functionName, `${keys.length}`, ...keys, ...parameters];
}

export async function fcallRo<T>(
  this: T,
  functionName: string,
  keys: string[],
  parameters: string[],
): Promise<SolidisData> {
  return await executeCommand(
    this,
    createCommand(functionName, keys, parameters),
  );
}

import { executeCommand, tryReplyToConfigInfo } from './utils/index.ts';

import type { RespConfigInfo } from '../index.ts';

export function createCommand(parameter: string) {
  return ['CONFIG', 'GET', parameter];
}

export async function configGet<T>(
  this: T,
  parameter: string,
): Promise<RespConfigInfo> {
  return await executeCommand(
    this,
    createCommand(parameter),
    tryReplyToConfigInfo,
  );
}

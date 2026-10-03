import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type { CommandScoreBound } from '../index.ts';

export function createCommand(
  key: string,
  min: CommandScoreBound,
  max: CommandScoreBound,
) {
  return ['ZCOUNT', key, `${min}`, `${max}`];
}

export async function zcount<T>(
  this: T,
  key: string,
  min: CommandScoreBound,
  max: CommandScoreBound,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, min, max),
    tryReplyNumber,
  );
}

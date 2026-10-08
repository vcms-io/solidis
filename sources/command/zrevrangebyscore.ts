import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

import type { CommandScoreBound } from '../index.ts';

export function createCommand(
  key: string,
  max: CommandScoreBound,
  min: CommandScoreBound,
) {
  return ['ZREVRANGEBYSCORE', key, `${max}`, `${min}`];
}

export async function zrevrangebyscore<T>(
  this: T,
  key: string,
  max: CommandScoreBound,
  min: CommandScoreBound,
): Promise<string[]> {
  return await executeCommand(
    this,
    createCommand(key, max, min),
    tryReplyToStringArray,
  );
}

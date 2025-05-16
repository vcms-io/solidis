import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

import type { CommandLeftOrRightOption } from '../index.ts';

export function createCommand(
  source: string,
  destination: string,
  wherefrom: CommandLeftOrRightOption,
  whereto: CommandLeftOrRightOption,
) {
  return ['LMOVE', source, destination, wherefrom, whereto];
}

export async function lmove<T>(
  this: T,
  source: string,
  destination: string,
  wherefrom: CommandLeftOrRightOption,
  whereto: CommandLeftOrRightOption,
): Promise<string | null> {
  return await executeCommand(
    this,
    createCommand(source, destination, wherefrom, whereto),
    tryReplyToStringOrNull,
  );
}

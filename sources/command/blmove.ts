import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

import type { CommandLeftOrRightOption } from '../index.ts';

export function createCommand(
  source: string,
  destination: string,
  whereFrom: CommandLeftOrRightOption,
  whereTo: CommandLeftOrRightOption,
  timeout: number,
) {
  return ['BLMOVE', source, destination, whereFrom, whereTo, `${timeout}`];
}

export async function blmove<T>(
  this: T,
  source: string,
  destination: string,
  whereFrom: CommandLeftOrRightOption,
  whereTo: CommandLeftOrRightOption,
  timeout: number,
): Promise<string | null> {
  return await executeCommand(
    this,
    createCommand(source, destination, whereFrom, whereTo, timeout),
    tryReplyToStringOrNull,
  );
}

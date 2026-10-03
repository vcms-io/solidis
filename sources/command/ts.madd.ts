import { executeCommand, tryReplyToNumberOrErrorArray } from './utils/index.ts';

import type { RespError } from '../index.ts';

export function createCommand(
  key: string,
  samples: Array<{ timestamp: number; value: number }>,
) {
  const command = ['TS.MADD'];

  for (const sample of samples) {
    command.push(key, `${sample.timestamp}`, `${sample.value}`);
  }

  return command;
}

export async function tsMadd<T>(
  this: T,
  key: string,
  samples: Array<{ timestamp: number; value: number }>,
): Promise<(number | RespError)[]> {
  return await executeCommand(
    this,
    createCommand(key, samples),
    (reply, command) =>
      tryReplyToNumberOrErrorArray(reply, command, samples.length),
  );
}

import { formatInteger } from '../common/utils/internal.ts';
import {
  executeCommand,
  tryReplyToNumber,
  tryReplyToValueOrErrorArray,
} from './utils/index.ts';

import type { CommandTimeSeriesSampleTimestamp, RespError } from '../index.ts';

export function createCommand(
  key: string,
  samples: Array<{
    timestamp: CommandTimeSeriesSampleTimestamp;
    value: number;
  }>,
) {
  const command = ['TS.MADD'];

  for (const sample of samples) {
    command.push(key, formatInteger(sample.timestamp), `${sample.value}`);
  }

  return command;
}

export async function tsMadd<T>(
  this: T,
  key: string,
  samples: Array<{
    timestamp: CommandTimeSeriesSampleTimestamp;
    value: number;
  }>,
): Promise<(number | RespError)[]> {
  const count = samples.length;

  return await executeCommand(
    this,
    createCommand(key, samples),
    (reply, command) =>
      tryReplyToValueOrErrorArray(reply, command, count, tryReplyToNumber),
  );
}

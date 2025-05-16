import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

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
): Promise<number[]> {
  return await executeCommand(
    this,
    createCommand(key, samples),
    tryReplyToNumberArray,
  );
}

import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(
  key: string,
  field: string,
  millisecondsTimestamp: number,
) {
  return ['HPEXPIREAT', key, field, `${millisecondsTimestamp}`];
}

export async function hpexpireat<T>(
  this: T,
  key: string,
  field: string,
  millisecondsTimestamp: number,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, field, millisecondsTimestamp),
    tryReplyNumber,
  );
}

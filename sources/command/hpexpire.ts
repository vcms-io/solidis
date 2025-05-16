import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(
  key: string,
  field: string,
  milliseconds: number,
) {
  return ['HPEXPIRE', key, field, `${milliseconds}`];
}

export async function hpexpire<T>(
  this: T,
  key: string,
  field: string,
  milliseconds: number,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, field, milliseconds),
    tryReplyNumber,
  );
}

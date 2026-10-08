import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(key: string, start: number, stop: number) {
  return ['LTRIM', key, formatInteger(start), formatInteger(stop)];
}

export async function ltrim<T>(
  this: T,
  key: string,
  start: number,
  stop: number,
) {
  return await executeCommand(
    this,
    createCommand(key, start, stop),
    tryReplyOK,
  );
}

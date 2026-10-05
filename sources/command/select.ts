import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(index: number) {
  return ['SELECT', formatInteger(index)];
}

export async function select<T>(this: T, index: number) {
  return await executeCommand(this, createCommand(index), tryReplyOK);
}

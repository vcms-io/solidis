import { appendItems } from '../common/utils/internal.ts';
import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(...keys: string[]) {
  return ['WATCH', ...keys];
}

export async function watch<T>(this: T, ...keys: string[]) {
  return await executeCommand(
    this,
    appendItems(createCommand(), keys),
    tryReplyOK,
  );
}

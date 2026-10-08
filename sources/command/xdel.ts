import { appendItems } from '../common/utils/internal.ts';
import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, ...ids: string[]) {
  return ['XDEL', key, ...ids];
}

export async function xdel<T>(
  this: T,
  key: string,
  ...ids: string[]
): Promise<number> {
  return await executeCommand(
    this,
    appendItems(createCommand(key), ids),
    tryReplyNumber,
  );
}

import { appendItems } from '../common/utils/internal.ts';
import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, ...fields: string[]) {
  return ['HDEL', key, ...fields];
}

export async function hdel<T>(
  this: T,
  key: string,
  ...fields: string[]
): Promise<number> {
  return await executeCommand(
    this,
    appendItems(createCommand(key), fields),
    tryReplyNumber,
  );
}

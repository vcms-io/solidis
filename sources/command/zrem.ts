import { appendItems } from '../common/utils/internal.ts';
import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(key: string, ...members: string[]) {
  return ['ZREM', key, ...members];
}

export async function zrem<T>(
  this: T,
  key: string,
  ...members: string[]
): Promise<number> {
  return await executeCommand(
    this,
    appendItems(createCommand(key), members),
    tryReplyNumber,
  );
}

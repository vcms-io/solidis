import { appendItems } from '../common/utils/internal.ts';
import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(...keys: string[]) {
  return ['SUNION', ...keys];
}

export async function sunion<T>(this: T, ...keys: string[]): Promise<string[]> {
  return await executeCommand(
    this,
    appendItems(createCommand(), keys),
    tryReplyToStringArray,
  );
}

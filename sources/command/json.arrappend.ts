import { appendItems } from '../common/utils/internal.ts';
import { executeCommand, tryReplyToJsonNumbers } from './utils/index.ts';

export function createCommand(key: string, path: string, ...values: string[]) {
  return ['JSON.ARRAPPEND', key, path, ...values];
}

export async function jsonArrappend<T>(
  this: T,
  key: string,
  path: string,
  ...values: string[]
): Promise<(number | null)[]> {
  return await executeCommand(
    this,
    appendItems(createCommand(key, path), values),
    tryReplyToJsonNumbers,
  );
}

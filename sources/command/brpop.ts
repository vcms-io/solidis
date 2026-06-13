import { executeCommand, tryReplyToKeyValuePairOrNull } from './utils/index.ts';

export function createCommand(keys: string[], timeout: number) {
  return ['BRPOP', ...keys, `${timeout}`];
}

export async function brpop<T>(
  this: T,
  keys: string[],
  timeout: number,
): Promise<[string, string] | null> {
  return await executeCommand(
    this,
    createCommand(keys, timeout),
    tryReplyToKeyValuePairOrNull,
  );
}

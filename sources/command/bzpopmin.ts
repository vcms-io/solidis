import {
  executeCommand,
  tryReplyToKeyMemberScoreOrNull,
} from './utils/index.ts';

export function createCommand(keys: string[], timeout: number) {
  return ['BZPOPMIN', ...keys, `${timeout}`];
}

export async function bzpopmin<T>(
  this: T,
  keys: string[],
  timeout: number,
): Promise<[string, string, string] | null> {
  return await executeCommand(
    this,
    createCommand(keys, timeout),
    tryReplyToKeyMemberScoreOrNull,
  );
}

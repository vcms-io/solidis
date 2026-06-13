import {
  executeCommand,
  tryReplyToKeyMemberScoreOrNull,
} from './utils/index.ts';

export function createCommand(keys: string[], timeout: number) {
  return ['BZPOPMAX', ...keys, `${timeout}`];
}

export async function bzpopmax<T>(
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

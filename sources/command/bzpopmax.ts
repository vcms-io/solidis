import { formatBlockingTimeout } from '../common/utils/internal.ts';
import {
  executeCommand,
  tryReplyToKeyMemberScoreOrNull,
} from './utils/index.ts';

export function createCommand(keys: string[], timeout: number) {
  return ['BZPOPMAX', ...keys, formatBlockingTimeout(timeout)];
}

export async function bzpopmax<T>(
  this: T,
  keys: string[],
  timeout: number,
): Promise<[key: string, member: string, score: number] | null> {
  return await executeCommand(
    this,
    createCommand(keys, timeout),
    tryReplyToKeyMemberScoreOrNull,
    undefined,
    { blockingTimeout: timeout * 1000 },
  );
}

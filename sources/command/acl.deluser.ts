import { appendItems } from '../common/utils/internal.ts';
import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(...usernames: string[]) {
  return ['ACL', 'DELUSER', ...usernames];
}

export async function aclDeluser<T>(this: T, ...usernames: string[]) {
  return await executeCommand(
    this,
    appendItems(createCommand(), usernames),
    tryReplyNumber,
  );
}

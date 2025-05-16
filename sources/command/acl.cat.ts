import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(category?: string) {
  const command = ['ACL', 'CAT'];

  if (category) {
    command.push(category);
  }

  return command;
}

export async function aclCat<T>(this: T, category?: string) {
  return await executeCommand(
    this,
    createCommand(category),
    tryReplyToStringArray,
  );
}

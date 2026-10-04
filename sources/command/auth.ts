import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(
  username?: StringOrBuffer,
  password?: StringOrBuffer,
) {
  const commands: StringOrBuffer[] = ['AUTH'];

  if (password !== undefined) {
    commands.push(username || 'default', password);
  } else if (username !== undefined) {
    commands.push(username);
  }

  return commands;
}

export async function auth<T>(
  this: T,
  ...parameters:
    | [password: StringOrBuffer]
    | [username: StringOrBuffer | undefined, password: StringOrBuffer]
) {
  const [first, second] = parameters;

  return await executeCommand(this, createCommand(first, second), tryReplyOK);
}

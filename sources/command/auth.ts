import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(
  username?: StringOrBuffer,
  password?: StringOrBuffer,
) {
  const commands: StringOrBuffer[] = ['AUTH'];

  if (username && password) {
    commands.push(username, password);
  } else if (password) {
    commands.push('default', password);
  } else if (username) {
    commands.push(username);
  }

  return commands;
}

export async function auth<T>(
  this: T,
  username?: StringOrBuffer,
  password?: StringOrBuffer,
) {
  return await executeCommand(
    this,
    createCommand(username, password),
    tryReplyOK,
  );
}

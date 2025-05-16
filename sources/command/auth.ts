import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(username?: string, password?: string) {
  const commands = ['AUTH'];

  if (username && password) {
    commands.push(username, password);
  } else if (password) {
    commands.push('default', password);
  } else if (username) {
    commands.push(username);
  }

  return commands;
}

export async function auth<T>(this: T, username?: string, password?: string) {
  return await executeCommand(
    this,
    createCommand(username, password),
    tryReplyOK,
  );
}

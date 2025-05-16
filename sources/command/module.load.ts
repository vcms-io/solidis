import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(path: string, parameters?: string[]) {
  const command = ['MODULE', 'LOAD', path];

  if (parameters?.length) {
    command.push(...parameters);
  }

  return command;
}

export async function moduleLoad<T>(
  this: T,
  path: string,
  parameters?: string[],
) {
  return await executeCommand(
    this,
    createCommand(path, parameters),
    tryReplyOK,
  );
}

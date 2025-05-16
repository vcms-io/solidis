import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

export function createCommand(key: string, path?: string) {
  const command = ['JSON.ARRLEN', key];

  if (path !== undefined) {
    command.push(path);
  }

  return command;
}

export async function jsonArrlen<T>(
  this: T,
  key: string,
  path?: string,
): Promise<(number | null)[]> {
  return await executeCommand(
    this,
    createCommand(key, path),
    (reply, command) => tryReplyToNumberArray(reply, command, true),
  );
}

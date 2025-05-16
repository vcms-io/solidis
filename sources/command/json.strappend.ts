import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

export function createCommand(key: string, value: string, path?: string) {
  const command = ['JSON.STRAPPEND', key];

  if (path !== undefined) {
    command.push(path);
  }

  command.push(value);

  return command;
}

export async function jsonStrappend<T>(
  this: T,
  key: string,
  value: string,
  path?: string,
): Promise<(number | null)[]> {
  return await executeCommand(
    this,
    createCommand(key, value, path),
    (reply, command) => tryReplyToNumberArray(reply, command, true),
  );
}

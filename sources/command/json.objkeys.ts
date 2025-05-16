import { executeCommand, tryReplyToStringArray } from './utils/index.ts';

export function createCommand(key: string, path?: string) {
  const command = ['JSON.OBJKEYS', key];

  if (path !== undefined) {
    command.push(path);
  }

  return command;
}

export async function jsonObjkeys<T>(
  this: T,
  key: string,
  path?: string,
): Promise<(string | null)[]> {
  return await executeCommand(
    this,
    createCommand(key, path),
    (reply, command) => tryReplyToStringArray(reply, command, true),
  );
}

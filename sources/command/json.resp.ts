import { executeCommand, tryReplyArray } from './utils/index.ts';

import type { SolidisData } from '../index.ts';

export function createCommand(key: string, path?: string) {
  const command = ['JSON.RESP', key];

  if (path !== undefined) {
    command.push(path);
  }

  return command;
}

export async function jsonResp<T>(
  this: T,
  key: string,
  path?: string,
): Promise<SolidisData[]> {
  return await executeCommand(
    this,
    createCommand(key, path),
    (reply, command) => tryReplyArray(reply, command),
  );
}

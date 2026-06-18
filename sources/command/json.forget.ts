import {
  buildJsonKeyPathCommand,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

export function createCommand(key: string, path?: string) {
  return buildJsonKeyPathCommand('JSON.FORGET', key, path);
}

export async function jsonForget<T>(
  this: T,
  key: string,
  path?: string,
): Promise<number> {
  return await executeCommand(this, createCommand(key, path), tryReplyNumber);
}

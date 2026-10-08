import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(path: string, parameters?: string[]) {
  return ['MODULE', 'LOAD', path, ...(parameters ?? [])];
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

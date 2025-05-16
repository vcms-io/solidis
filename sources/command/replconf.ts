import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(subcommand: string, ...arguments_: string[]) {
  return ['REPLCONF', subcommand, ...arguments_];
}

export async function replconf<T>(
  this: T,
  subcommand: string,
  ...arguments_: string[]
) {
  return await executeCommand(
    this,
    createCommand(subcommand, ...arguments_),
    tryReplyOK,
  );
}

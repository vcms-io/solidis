import { appendItems } from '../common/utils/internal.ts';
import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(subcommand: string, ...parameters: string[]) {
  return ['REPLCONF', subcommand, ...parameters];
}

export async function replconf<T>(
  this: T,
  subcommand: string,
  ...parameters: string[]
) {
  return await executeCommand(
    this,
    appendItems(createCommand(subcommand), parameters),
    tryReplyOK,
  );
}

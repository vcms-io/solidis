import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(attribute: string, value: string) {
  return ['CLIENT', 'SETINFO', attribute, value];
}

export async function clientSetinfo<T>(
  this: T,
  attribute: string,
  value: string,
) {
  return await executeCommand(
    this,
    createCommand(attribute, value),
    tryReplyOK,
  );
}

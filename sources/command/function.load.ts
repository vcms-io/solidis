import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand(code: string, replace: boolean) {
  const command = ['FUNCTION', 'LOAD'];

  if (replace) {
    command.push('REPLACE');
  }

  command.push(code);

  return command;
}

export async function functionLoad<T>(
  this: T,
  code: string,
  replace = false,
): Promise<string> {
  return await executeCommand(
    this,
    createCommand(code, replace),
    tryReplyToString,
  );
}

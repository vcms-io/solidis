import {
  executeCommand,
  tryReplyToNumberScalarOrArray,
} from './utils/index.ts';

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
): Promise<number | null>;
export async function jsonStrappend<T>(
  this: T,
  key: string,
  value: string,
  path: string,
): Promise<number | (number | null)[] | null>;
export async function jsonStrappend<T>(
  this: T,
  key: string,
  value: string,
  path?: string,
): Promise<number | (number | null)[] | null> {
  return await executeCommand(
    this,
    createCommand(key, value, path),
    tryReplyToNumberScalarOrArray,
  );
}

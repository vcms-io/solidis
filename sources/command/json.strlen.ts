import {
  executeCommand,
  tryReplyToNumberScalarOrArray,
} from './utils/index.ts';

export function createCommand(key: string, path?: string) {
  const command = ['JSON.STRLEN', key];

  if (path !== undefined) {
    command.push(path);
  }

  return command;
}

export async function jsonStrlen<T>(
  this: T,
  key: string,
): Promise<number | null>;
export async function jsonStrlen<T>(
  this: T,
  key: string,
  path: string,
): Promise<number | (number | null)[] | null>;
export async function jsonStrlen<T>(
  this: T,
  key: string,
  path?: string,
): Promise<number | (number | null)[] | null> {
  return await executeCommand(
    this,
    createCommand(key, path),
    tryReplyToNumberScalarOrArray,
  );
}

import {
  executeCommand,
  tryReplyToStringScalarOrArray,
} from './utils/index.ts';

export function createCommand(key: string, path?: string, index?: number) {
  const command = ['JSON.ARRPOP', key];

  if (path !== undefined) {
    command.push(path);

    if (index !== undefined) {
      command.push(`${index}`);
    }
  }

  return command;
}

export async function jsonArrpop<T>(
  this: T,
  key: string,
): Promise<string | null>;
export async function jsonArrpop<T>(
  this: T,
  key: string,
  path: string,
  index?: number,
): Promise<string | (string | null)[] | null>;
export async function jsonArrpop<T>(
  this: T,
  key: string,
  path?: string,
  index?: number,
): Promise<string | (string | null)[] | null> {
  return await executeCommand(
    this,
    createCommand(key, path, index),
    tryReplyToStringScalarOrArray,
  );
}

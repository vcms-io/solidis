import {
  executeCommand,
  tryReplyNumber,
  tryReplyToStringArray,
} from './utils/index.ts';

export function createCommand(
  subcommand: 'MEMORY' | 'HELP',
  key?: string,
  path?: string,
) {
  const command = ['JSON.DEBUG', subcommand];

  if (subcommand === 'MEMORY' && key !== undefined) {
    command.push(key);

    if (path !== undefined) {
      command.push(path);
    }
  }

  return command;
}

export async function jsonDebug<T>(
  this: T,
  subcommand: 'HELP',
): Promise<string[]>;
export async function jsonDebug<T>(
  this: T,
  subcommand: 'MEMORY',
  key: string,
  path?: string,
): Promise<number>;
export async function jsonDebug<T>(
  this: T,
  subcommand: 'MEMORY' | 'HELP',
  key?: string,
  path?: string,
): Promise<string[] | number> {
  return await executeCommand(
    this,
    createCommand(subcommand, key, path),
    (reply, command) => {
      if (subcommand === 'HELP') {
        return tryReplyToStringArray(reply, command);
      }

      return tryReplyNumber(reply, command);
    },
  );
}
